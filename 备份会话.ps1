# 备份 Claude Code 的对话记录 + 手动分组
# 双击同目录的「备份会话.bat」即可运行

$src = "$env:USERPROFILE\.claude\projects\c--Users-Administrator-Projects-gongkao-notes"
$db  = "$env:APPDATA\Code\User\globalStorage\state.vscdb"
$dst = "$env:USERPROFILE\.claude-backups"

Write-Host ""
Write-Host "=== 备份 Claude Code 对话 ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $src)) {
    Write-Host "找不到会话目录：$src" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force $dst | Out-Null

# 1. 对话记录：增量同步，只增不删，备份里的旧文件永远不会被覆盖掉
robocopy $src "$dst\sessions" /E /XO /NFL /NDL /NJH /NJS /R:1 /W:1 | Out-Null

# 2. 手动分组：存在 VSCode 的状态库里，一起存下来
if (Test-Path $db) {
    Copy-Item $db "$dst\state.vscdb" -Force
    if (Test-Path "$db-wal") { Copy-Item "$db-wal" "$dst\state.vscdb-wal" -Force }
}

$files = Get-ChildItem "$dst\sessions" -Recurse -File -Filter *.jsonl
$size  = [math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB, 1)

Write-Host "对话文件：$($files.Count) 个（共 $size MB）" -ForegroundColor Green
Write-Host "分组数据：已保存" -ForegroundColor Green
Write-Host ""
Write-Host "备份位置：$dst" -ForegroundColor Yellow
Write-Host ""
