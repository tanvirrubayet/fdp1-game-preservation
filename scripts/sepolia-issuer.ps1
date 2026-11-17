param(
    [ValidateSet('Address', 'Deploy', 'Demo', 'Verify', 'TestArchive')]
    [string] $Action = 'Address'
)

$ErrorActionPreference = 'Stop'
$previousKey = $env:SEPOLIA_PRIVATE_KEY
$previousWalletA = $env:SEPOLIA_DEMO_HOLDER_A_PRIVATE_KEY
$previousWalletB = $env:SEPOLIA_DEMO_HOLDER_B_PRIVATE_KEY

function Get-LocalTestKey {
    param([string] $Filename)

    # Store test keys outside the repository, encrypted for this Windows user.
    $keyFolder = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'GamePreservationToken\Sepolia'
    $keyPath = Join-Path $keyFolder $Filename
    if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
        New-Item -ItemType Directory -Path $keyFolder -Force | Out-Null
        $newKey = node --input-type=module -e 'import { generatePrivateKey } from "viem/accounts"; process.stdout.write(generatePrivateKey());'
        if ($LASTEXITCODE -ne 0 -or $newKey -notmatch '^0x[0-9a-fA-F]{64}$') {
            throw 'Could not generate a Sepolia test key.'
        }
        $encrypted = ConvertTo-SecureString -String $newKey -AsPlainText -Force | ConvertFrom-SecureString
        # CreateNew prevents a simultaneous process from overwriting an existing key.
        $file = [System.IO.File]::Open($keyPath, 'CreateNew', 'Write')
        try {
            $encoded = [System.Text.Encoding]::UTF8.GetBytes($encrypted)
            $file.Write($encoded, 0, $encoded.Length)
        } finally {
            $file.Dispose()
        }
    }

    $protectedKey = Get-Content -LiteralPath $keyPath -Raw | ConvertTo-SecureString
    return [System.Net.NetworkCredential]::new('', $protectedKey).Password
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    if ([string]::IsNullOrWhiteSpace($previousKey)) {
        $env:SEPOLIA_PRIVATE_KEY = Get-LocalTestKey 'issuer.dpapi'
    }
    if ($env:SEPOLIA_PRIVATE_KEY -notmatch '^0x[0-9a-fA-F]{64}$') {
        throw 'Set SEPOLIA_PRIVATE_KEY to a 0x-prefixed Sepolia test-wallet key in your local terminal.'
    }

    if ($Action -in 'Demo', 'TestArchive') {
        # Keep the archive demo wallets distinct from each other and from the issuer.
        if ([string]::IsNullOrWhiteSpace($previousWalletA)) {
            $env:SEPOLIA_DEMO_HOLDER_A_PRIVATE_KEY = Get-LocalTestKey 'wallet-a.dpapi'
        }
        if ([string]::IsNullOrWhiteSpace($previousWalletB)) {
            $env:SEPOLIA_DEMO_HOLDER_B_PRIVATE_KEY = Get-LocalTestKey 'wallet-b.dpapi'
        }
        $keys = @($env:SEPOLIA_PRIVATE_KEY, $env:SEPOLIA_DEMO_HOLDER_A_PRIVATE_KEY, $env:SEPOLIA_DEMO_HOLDER_B_PRIVATE_KEY)
        if (($keys | Where-Object { $_ -notmatch '^0x[0-9a-fA-F]{64}$' }) -or ($keys | Sort-Object -Unique).Count -ne 3) {
            throw 'Use three distinct, valid Sepolia test-wallet keys for the demo.'
        }
    }

    switch ($Action) {
        'Address' {
            node --input-type=module -e 'import { privateKeyToAccount } from "viem/accounts"; try { console.log(privateKeyToAccount(process.env.SEPOLIA_PRIVATE_KEY).address); } catch { process.exitCode = 1; }'
        }
        'Deploy' { pnpm run deploy:sepolia }
        'Demo' { pnpm run demo:sepolia }
        'TestArchive' { node archive/test_handover.mjs }
        'Verify' { pnpm exec hardhat ignition verify chain-11155111 --network sepolia }
    }
    if ($LASTEXITCODE -ne 0) { throw 'Sepolia command failed.' }
} finally {
    $env:SEPOLIA_PRIVATE_KEY = $previousKey
    $env:SEPOLIA_DEMO_HOLDER_A_PRIVATE_KEY = $previousWalletA
    $env:SEPOLIA_DEMO_HOLDER_B_PRIVATE_KEY = $previousWalletB
    Pop-Location
}
