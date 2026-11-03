# DevnDespro SEO Stripe sandbox catalog sync
# Requires PowerShell 7 and STRIPE_SECRET_KEY set locally to an sk_test_ key.
# Defaults to preview mode; -Apply creates missing sandbox products and prices.
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$key = $env:STRIPE_SECRET_KEY
if (-not $key -or -not $key.StartsWith('sk_test_')) { throw 'A Stripe test secret key is required.' }
$headers = @{ Authorization = "Bearer $key" }
$plans = @(
    @{ Name='DevnDespro SEO - Launch'; Code='launch'; Amount=9900 },
    @{ Name='DevnDespro SEO - Accelerate'; Code='accelerate'; Amount=19900 },
    @{ Name='DevnDespro SEO - Command'; Code='command'; Amount=39900 }
)
function Get-StripeItems($resource) {
    $all = @()
    $cursor = $null
    do {
        $url = "https://api.stripe.com/v1/$resource?limit=100"
        if ($cursor) { $url += "&starting_after=$cursor" }
        $page = Invoke-RestMethod -Uri $url -Headers $headers
        $all += @($page.data)
        if ($page.has_more -and @($page.data).Count -eq 0) { throw 'Unexpected empty Stripe page.' }
        $cursor = if (@($page.data).Count) { $page.data[-1].id } else { $null }
    } while ($page.has_more)
    return $all
}
function New-StripeItem($resource, $fields, $idempotency) {
    Invoke-RestMethod -Method Post -Uri "https://api.stripe.com/v1/$resource" -Headers @{
        Authorization = "Bearer $key"
        'Idempotency-Key' = $idempotency
    } -ContentType 'application/x-www-form-urlencoded' -Body $fields
}
$products = @(Get-StripeItems 'products')
$prices = @(Get-StripeItems 'prices')
foreach ($plan in $plans) {
    $matches = @($products | Where-Object { $_.name -eq $plan.Name -and $_.active })
    if ($matches.Count -gt 1) { throw "Ambiguous product: $($plan.Name)" }
    $product = if ($matches.Count) { $matches[0] } else { $null }
    if (-not $product -and $Apply) {
        $product = New-StripeItem 'products' @{ name=$plan.Name; 'metadata[devndespro_plan]'=$plan.Code } "devndespro-$($plan.Code)-product-v1"
        $products += $product
    }
    $price = $null
    if ($product) {
        $found = @($prices | Where-Object {
            $_.product -eq $product.id -and $_.active -and $_.currency -eq 'nok' -and
            $_.unit_amount -eq $plan.Amount -and $_.recurring.interval -eq 'month' -and
            $_.recurring.interval_count -eq 1
        })
        if ($found.Count -gt 1) { throw "Ambiguous price: $($plan.Name)" }
        if ($found.Count) { $price = $found[0] }
        elseif ($Apply) {
            $price = New-StripeItem 'prices' @{
                product=$product.id; currency='nok'; unit_amount=[string]$plan.Amount
                'recurring[interval]'='month'
            } "devndespro-$($plan.Code)-monthly-$($plan.Amount)-v1"
            $prices += $price
        }
    }
    [pscustomobject]@{
        Plan=$plan.Code; NOKPerMonth=($plan.Amount / 100)
        ProductId=if ($product) { $product.id } else { '(missing)' }
        PriceId=if ($price) { $price.id } else { '(missing)' }
    }
}
if (-not $Apply) { Write-Host 'Preview only. Run with -Apply to create missing test catalog entries.' }
