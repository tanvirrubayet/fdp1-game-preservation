"""Extract the actual backup download and play its built-in demo with no network."""

import argparse
from contextlib import ExitStack
import ctypes as ct
from ctypes import wintypes as w
from datetime import datetime, timezone
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import msvcrt
import os
from pathlib import Path
import re
from subprocess import list2cmdline, run
from tempfile import TemporaryDirectory, mkdtemp
from threading import Thread
from urllib.request import urlopen
from uuid import uuid4


# Windows creates a low-integrity AppContainer when this process attribute is present.
SECURITY_CAPABILITIES_ATTRIBUTE = 0x00020009
EXTENDED_STARTUPINFO_PRESENT = 0x00080000
CREATE_NO_WINDOW = 0x08000000
CREATE_SUSPENDED = 0x00000004
STARTF_USESTDHANDLES = 0x00000100
TOKEN_QUERY = 0x0008
TOKEN_IS_APP_CONTAINER = 29
TOKEN_CAPABILITIES = 30
NETWORK_CAPABILITY_SIDS = {"S-1-15-3-1", "S-1-15-3-2", "S-1-15-3-3"}
SYSTEM32 = Path(os.environ["SystemRoot"]) / "System32"

kernel = ct.WinDLL("kernel32", use_last_error=True)
userenv = ct.WinDLL("userenv", use_last_error=True)
advapi = ct.WinDLL("advapi32", use_last_error=True)
ptr = ct.c_void_p


class StartupInfo(ct.Structure):
    _fields_ = [
        ("cb", w.DWORD), ("reserved", w.LPWSTR), ("desktop", w.LPWSTR),
        ("title", w.LPWSTR), ("x", w.DWORD), ("y", w.DWORD),
        ("x_size", w.DWORD), ("y_size", w.DWORD), ("x_chars", w.DWORD),
        ("y_chars", w.DWORD), ("fill", w.DWORD), ("flags", w.DWORD),
        ("show_window", w.WORD), ("reserved_size", w.WORD), ("reserved_bytes", ptr),
        ("stdin", w.HANDLE), ("stdout", w.HANDLE), ("stderr", w.HANDLE),
    ]


class StartupInfoEx(ct.Structure):
    _fields_ = [("startup", StartupInfo), ("attributes", ptr)]


class ProcessInfo(ct.Structure):
    _fields_ = [
        ("process", w.HANDLE), ("thread", w.HANDLE),
        ("pid", w.DWORD), ("thread_id", w.DWORD),
    ]


class SecurityCapabilities(ct.Structure):
    _fields_ = [("sid", ptr), ("capabilities", ptr), ("count", w.DWORD), ("reserved", w.DWORD)]


class SidAndAttributes(ct.Structure):
    _fields_ = [("sid", ptr), ("flags", w.DWORD)]


class TokenGroups(ct.Structure):
    _fields_ = [("count", w.DWORD), ("groups", SidAndAttributes * 1)]


def bind(dll, name, args, result=w.BOOL):
    function = getattr(dll, name)
    function.argtypes = args
    function.restype = result
    return function


create_profile = bind(userenv, "CreateAppContainerProfile",
                      [w.LPCWSTR, w.LPCWSTR, w.LPCWSTR, ptr, w.DWORD, ct.POINTER(ptr)], ct.c_long)
delete_profile = bind(userenv, "DeleteAppContainerProfile", [w.LPCWSTR], ct.c_long)
sid_to_string = bind(advapi, "ConvertSidToStringSidW", [ptr, ct.POINTER(w.LPWSTR)])
free_sid = bind(advapi, "FreeSid", [ptr], ptr)
local_free = bind(kernel, "LocalFree", [ptr], ptr)
close_handle = bind(kernel, "CloseHandle", [w.HANDLE])
open_token = bind(advapi, "OpenProcessToken", [w.HANDLE, w.DWORD, ct.POINTER(w.HANDLE)])
token_info = bind(advapi, "GetTokenInformation", [w.HANDLE, ct.c_int, ptr, w.DWORD, ct.POINTER(w.DWORD)])
init_attributes = bind(kernel, "InitializeProcThreadAttributeList",
                       [ptr, w.DWORD, w.DWORD, ct.POINTER(ct.c_size_t)])
set_attribute = bind(kernel, "UpdateProcThreadAttribute",
                     [ptr, w.DWORD, ct.c_size_t, ptr, ct.c_size_t, ptr, ptr])
free_attributes = bind(kernel, "DeleteProcThreadAttributeList", [ptr], None)
create_process = bind(kernel, "CreateProcessW", [
    w.LPCWSTR, w.LPWSTR, ptr, ptr, w.BOOL, w.DWORD, ptr, w.LPCWSTR,
    ct.POINTER(StartupInfoEx), ct.POINTER(ProcessInfo),
])
resume_thread = bind(kernel, "ResumeThread", [w.HANDLE], w.DWORD)
wait_for_exit = bind(kernel, "WaitForSingleObject", [w.HANDLE, w.DWORD], w.DWORD)
get_exit_code = bind(kernel, "GetExitCodeProcess", [w.HANDLE, ct.POINTER(w.DWORD)])


def checked(result):
    if not result:
        raise ct.WinError(ct.get_last_error())


def profile_sid_text(sid):
    text = w.LPWSTR()
    checked(sid_to_string(sid, ct.byref(text)))
    try:
        return text.value
    finally:
        local_free(ct.cast(text, ptr))


def read_isolation(process):
    token = w.HANDLE()
    checked(open_token(process, TOKEN_QUERY, ct.byref(token)))
    try:
        in_container = w.DWORD()
        length = w.DWORD()
        checked(token_info(token, TOKEN_IS_APP_CONTAINER, ct.byref(in_container),
                           ct.sizeof(in_container), ct.byref(length)))
        token_info(token, TOKEN_CAPABILITIES, None, 0, ct.byref(length))
        caps = ct.create_string_buffer(length.value)
        checked(token_info(token, TOKEN_CAPABILITIES, caps, length.value, ct.byref(length)))
        # Read the OS's effective capabilities as well as the AppContainer flag.
        count = w.DWORD.from_buffer(caps).value
        entries = (SidAndAttributes * count).from_buffer(caps, TokenGroups.groups.offset)
        return bool(in_container.value), [profile_sid_text(entry.sid) for entry in entries]
    finally:
        close_handle(token)


def run_isolated(folder, sid, program, arguments, log=None):
    capabilities = SecurityCapabilities(sid, None, 0, 0)
    size = ct.c_size_t()
    init_attributes(None, 1, 0, ct.byref(size))
    attributes = ct.create_string_buffer(size.value)
    checked(init_attributes(attributes, 1, 0, ct.byref(size)))
    process = ProcessInfo()
    try:
        checked(set_attribute(attributes, 0, SECURITY_CAPABILITIES_ATTRIBUTE,
                              ct.byref(capabilities), ct.sizeof(capabilities), None, None))
        startup = StartupInfoEx()
        startup.startup.cb = ct.sizeof(startup)
        startup.attributes = ct.cast(attributes, ptr)
        program = str(program)
        command = ct.create_unicode_buffer(list2cmdline([program, *arguments]))
        with ExitStack() as stack:
            if log:
                output = stack.enter_context(log.open("wb"))
                empty_input = stack.enter_context(open(os.devnull, "rb"))
                startup.startup.flags |= STARTF_USESTDHANDLES
                for stream in (output, empty_input):
                    handle = msvcrt.get_osfhandle(stream.fileno())
                    os.set_handle_inheritable(handle, True)
                    stack.callback(os.set_handle_inheritable, handle, False)
                startup.startup.stdout = startup.startup.stderr = msvcrt.get_osfhandle(output.fileno())
                startup.startup.stdin = msvcrt.get_osfhandle(empty_input.fileno())
            checked(create_process(program, command, None, None, bool(log),
                                   EXTENDED_STARTUPINFO_PRESENT | CREATE_NO_WINDOW | CREATE_SUSPENDED,
                                   None, str(folder), ct.byref(startup), ct.byref(process)))
        try:
            isolated, capabilities = read_isolation(process.process)
            if not isolated or NETWORK_CAPABILITY_SIDS.intersection(capabilities):
                raise RuntimeError("The Windows process lacks the required AppContainer network isolation.")
            if resume_thread(process.thread) == 0xFFFFFFFF:
                raise ct.WinError(ct.get_last_error())
            if wait_for_exit(process.process, 50_000) != 0:
                raise TimeoutError("The isolated install and launch did not finish.")
            exit_code = w.DWORD()
            checked(get_exit_code(process.process, ct.byref(exit_code)))
            return isolated, capabilities, exit_code.value
        except Exception:
            if wait_for_exit(process.process, 0) != 0:
                # End only the test command and its children if setup or playback stalls.
                run([SYSTEM32 / "taskkill.exe", "/pid", str(process.pid), "/t", "/f"],
                    capture_output=True, timeout=5)
            raise
        finally:
            close_handle(process.thread)
            close_handle(process.process)
    finally:
        free_attributes(attributes)


class Probe(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(204)
        self.end_headers()

    def log_message(self, _format, *_args):
        pass


def installation_script(port):
    return f"""@echo off
setlocal
"%SystemRoot%\\System32\\curl.exe" --noproxy "*" --connect-timeout 3 --max-time 5 --silent --show-error --fail http://127.0.0.1:{port}/ping > network.log 2>&1
set "NETWORK_EXIT=%ERRORLEVEL%"
>network-exit.txt echo(%NETWORK_EXIT%
if "%NETWORK_EXIT%"=="0" exit /b 20
"%SystemRoot%\\System32\\tar.exe" --no-same-permissions -xf backup-download.zip -C installed > install.log 2>&1
if errorlevel 1 exit /b 22
exit /b 0
"""


def grant_access(folder, sid):
    # Windows checks both the user and the AppContainer principal for this disposable directory.
    user = run([SYSTEM32 / "whoami.exe", "/user", "/fo", "csv", "/nh"],
               check=True, capture_output=True, timeout=5).stdout
    user_sid = re.search(rb"S-1-[0-9-]+", user).group().decode("ascii")
    icacls = SYSTEM32 / "icacls.exe"
    run([icacls, folder, "/grant", f"*{sid}:(OI)(CI)M", f"*{user_sid}:(OI)(CI)M", "/t"],
        check=True, capture_output=True, timeout=10)
    run([icacls, folder, "/setintegritylevel", "(OI)(CI)L", "/t"],
        check=True, capture_output=True, timeout=10)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("download", type=Path)
    parser.add_argument("--video", choices=("windows", "dummy"), default="windows")
    args = parser.parse_args()
    download = args.download.resolve()
    evidence = json.loads(download.with_name("handover.json").read_text(encoding="utf-8"))
    contents = download.read_bytes()
    digest = sha256(contents).hexdigest()
    if digest != evidence["package"]["sha256"] or evidence["steps"][-1]["step"] != "Handover passed":
        raise ValueError("This file must match the package from a completed backup handover.")
    results = Path(mkdtemp(prefix="offline-", dir=download.parent))
    profile = "FDP1.Offline." + uuid4().hex
    sid = ptr()
    hr = create_profile(profile, "FDP1 Offline Test", "Fresh profile with no granted network access", None, 0, ct.byref(sid))
    if hr < 0:
        raise OSError(f"CreateAppContainerProfile failed with 0x{hr & 0xffffffff:08x}")
    try:
        with TemporaryDirectory(prefix="fdp1-offline-") as directory:
            folder = Path(directory)
            (folder / "backup-download.zip").write_bytes(contents)
            with ThreadingHTTPServer(("127.0.0.1", 0), Probe) as probe:
                thread = Thread(target=probe.serve_forever, daemon=True)
                thread.start()
                port = probe.server_address[1]
                installed = folder / "installed"
                installed.mkdir()
                (folder / "install.cmd").write_bytes(installation_script(port).replace("\n", "\r\n").encode("ascii"))
                try:
                    sid_text = profile_sid_text(sid)
                    grant_access(folder, sid_text)
                    with urlopen(f"http://127.0.0.1:{port}/ping", timeout=3) as reply:
                        if reply.status != 204:
                            raise RuntimeError("The host network probe was unavailable.")
                    isolated, capabilities, install_exit = run_isolated(folder, sid, SYSTEM32 / "cmd.exe", ["/d", "/c", "install.cmd"])
                    if install_exit != 0 or not (installed / "freedoom1.wad").is_file():
                        raise RuntimeError(f"Offline ZIP extraction exited {install_exit}. Evidence at {results}")
                    (installed / "profile").mkdir()
                    grant_access(installed, sid_text)
                    # Start the installed game directly in the same no-network profile.
                    os.environ["SDL_VIDEODRIVER"] = args.video
                    os.environ["SDL_RENDER_DRIVER"] = "software"
                    game = installed / "engine" / "crispy-doom.exe"
                    game_args = [
                        "-iwad", str(installed / "freedoom1.wad"),
                        "-config", str(installed / "profile" / "doom.cfg"),
                        "-extraconfig", str(installed / "profile" / "crispy.cfg"),
                        "-savedir", str(installed / "profile"),
                        "-window", "-nosound", "-timedemo", "demo1", "-nogui",
                    ]
                    _, _, engine_exit = run_isolated(installed, sid, game, game_args, results / "engine.log")
                finally:
                    probe.shutdown()
                    for name in ("network.log", "network-exit.txt", "install.log"):
                        log = folder / name
                        if log.is_file():
                            (results / name).write_bytes(log.read_bytes())

            probe_exit = int((results / "network-exit.txt").read_text().strip())
            if probe_exit not in (7, 28):
                raise RuntimeError(f"Expected TCP connection failure from the AppContainer. Evidence at {results}")
            engine_log = (results / "engine.log").read_text(errors="replace")
            played = re.search(r"timed (\d+) gametics in (\d+) realtics", engine_log, re.IGNORECASE)
            if not played or int(played[1]) <= 0:
                raise RuntimeError(f"No completed Crispy Doom playback found. Evidence at {results}")

            report = {
                "status": "passed",
                "testedAt": datetime.now(timezone.utc).isoformat(),
                "platform": "Windows x64",
                "download": str(download),
                "sha256": digest,
                "environment": "Fresh Windows AppContainer using a new installation folder",
                "appContainer": isolated,
                "explicitCapabilitiesGranted": 0,
                "effectiveCapabilitySids": capabilities,
                "networkCapabilitySids": sorted(NETWORK_CAPABILITY_SIDS.intersection(capabilities)),
                "hostProbeHttpStatus": 204,
                "sandboxNetworkProbeExit": probe_exit,
                "gameDemo": "DEMO1",
                "engineExit": engine_exit,
                "videoDriver": args.video,
                "gameTics": int(played[1]),
                "realTics": int(played[2]),
                "audio": "disabled for the automated playback",
            }
            (results / "offline.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(report))
            print("Offline evidence directory " + str(results))
    finally:
        free_sid(sid)
        delete_profile(profile)


if __name__ == "__main__":
    main()
