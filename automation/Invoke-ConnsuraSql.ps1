[CmdletBinding(DefaultParameterSetName = "Direct")]
param(
    [Parameter(ParameterSetName = "Direct", Position = 0)]
    [Parameter(ValueFromPipeline = $true)]
    [string[]]$Sql,

    [Parameter(ParameterSetName = "File", Mandatory = $true)]
    [string]$FilePath,

    [string]$Container = "connsura-postgres",
    [string]$Database = "connsura",
    [string]$User = "postgres",
    [switch]$NoAlign
)

begin {
    $stdinBuffer = New-Object System.Collections.Generic.List[string]
}

process {
    if ($null -ne $Sql) {
        foreach ($line in $Sql) {
            $stdinBuffer.Add([string]$line)
        }
    }
}

end {
    $query = $null

    if ($PSCmdlet.ParameterSetName -eq "File") {
        if (-not (Test-Path -LiteralPath $FilePath)) {
            throw "SQL file not found: $FilePath"
        }
        $query = Get-Content -Raw -LiteralPath $FilePath
    } elseif ($stdinBuffer.Count -gt 0) {
        $query = $stdinBuffer -join "`n"
    } else {
        $query = $Sql
    }

    if ([string]::IsNullOrWhiteSpace($query)) {
        throw "No SQL provided. Use -Sql, -FilePath, or pipe SQL via stdin."
    }

    $args = @(
        "exec", "-i", $Container,
        "psql", "-U", $User, "-d", $Database,
        "-v", "ON_ERROR_STOP=1",
        "-f", "-"
    )

    if ($NoAlign) {
        $args += @("-A", "-t")
    }

    $query | docker @args

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
