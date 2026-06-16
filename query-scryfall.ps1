$headers = @{
  'User-Agent' = 'TCGPlaymat/1.0'
  'Accept' = 'application/json'
}
$body = @{
  identifiers = @(
    @{ name = 'Aurelia, the Warleader' }
    @{ name = 'Odric, Lunarch Marshal' }
  )
} | ConvertTo-Json -Depth 3

$response = Invoke-RestMethod -Uri 'https://api.scryfall.com/cards/collection' -Method POST -ContentType 'application/json' -Headers $headers -Body $body
$response.data | ConvertTo-Json -Depth 10
