param([switch]$Orders)
$ErrorActionPreference = 'Stop'
$backend = 'https://otaku-loot-box.onrender.com'
try {
    $health = Invoke-RestMethod -Uri "$backend/health" -TimeoutSec 90
    Write-Host "Backend online. Payment mode: $($health.mode)"
    try {
        $ready = Invoke-RestMethod -Uri "$backend/api/readiness" -TimeoutSec 30
        Write-Host "Order recording configured: $($ready.orderRecordingConfigured)"
        Write-Host "Real payments enabled: $($ready.livePaymentsEnabled)"
        Write-Host 'Confirm recording with a new test purchase; configuration alone is not proof.'
    } catch {
        Write-Host 'Setup status unavailable. The backend may not include this update yet.'
    }
    if ($Orders) {
        $secure = Read-Host 'Paste ORDER_AGENT_TOKEN from Render (hidden input)' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            $result = Invoke-RestMethod -Uri "$backend/api/orders" -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 90
            Write-Host "Orders returned: $(@($result.orders).Count) (maximum 100)"
            $result.orders | Select-Object id, receivedAt, status, amountTotal, currency | Format-Table -AutoSize
            Write-Host 'Amounts are minor currency units: 2499 USD means $24.99. Addresses are not printed.'
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
            $token = $null
            $result = $null
            $secure = $null
        }
    }
} catch {
    Write-Host 'Check failed. Verify Render is running. For orders, verify all three queue settings and your token.'
    Write-Host 'This script never charges a card or purchases a product.'
    exit 1
}
