$f = Get-Content -Path "D:\Documents\realprojects\realstateApp\backend\src\modules\public\public.service.ts"

function Find-Substring($arr, $needle) {
  for ($i = 0; $i -lt $arr.Count; $i++) {
    if ($arr[$i] -like "*$needle*") { return $i }
  }
  return -1
}

$sA = [Array]::IndexOf($f, "export async function listBinaListings")
$eA = [Array]::IndexOf($f, "export async function getBinaStats")
$sB = [Array]::IndexOf($f, "import { BinaRawProperty, binaSmartService, BinaSearchPropertiesArgs } from '../../modules/bina';")
$basisIdx = Find-Substring $f "Monthly medians of ACTIVE listings on APPROVED properties"
$endB = $basisIdx - 2

Write-Host "sA=$sA eA=$eA sB=$sB basisIdx=$basisIdx endB=$endB"

$chunkA = @($f[$sA..($eA - 1)])
$chunkB = @($f[$sB..$endB])
$original = @($f[0..($sA - 1)]) + @($f[($eA)..($sB - 1)]) + @($f[($endB + 1)..($f.Length - 1)])

Write-Host "chunkALen=$($chunkA.Count) chunkBlen=$($chunkB.Count) originalLen=$($original.Count)"

# Add the bina import after the last existing import in $original
$lastImport = 0
for ($i = 0; $i -lt $original.Count; $i++) {
  if ($original[$i] -match "^\s*import\b") { $lastImport = $i } else { break }
}

$newFile = @($original[0..$lastImport]) +
  @("import { BinaRawProperty, binaSmartService, BinaSearchPropertiesArgs } from '../../modules/bina';") +
  @($original[$lastImport + 1..($original.Count - 1)]) +
  @($chunkA) +
  @($chunkB[1..($chunkB.Count - 1)])

$newFile | Set-Content -Path "D:\Documents\realprojects\realstateApp\backend\src\modules\public\public.service.ts" -Encoding UTF8
Write-Host "NEWLEN=$($newFile.Count)"
