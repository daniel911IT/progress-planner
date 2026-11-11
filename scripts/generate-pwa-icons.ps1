Add-Type -AssemblyName System.Drawing

function New-RoundedPath([single]$X, [single]$Y, [single]$Width, [single]$Height, [single]$Radius) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = $Radius * 2
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function Add-Star([System.Drawing.Graphics]$Graphics, [single]$CenterX, [single]$CenterY, [single]$OuterX, [single]$OuterY, [single]$InnerX, [single]$InnerY, [System.Drawing.Brush]$Brush) {
    $points = @(
        [System.Drawing.PointF]::new($CenterX, $CenterY - $OuterY),
        [System.Drawing.PointF]::new($CenterX + $InnerX, $CenterY - $InnerY),
        [System.Drawing.PointF]::new($CenterX + $OuterX, $CenterY),
        [System.Drawing.PointF]::new($CenterX + $InnerX, $CenterY + $InnerY),
        [System.Drawing.PointF]::new($CenterX, $CenterY + $OuterY),
        [System.Drawing.PointF]::new($CenterX - $InnerX, $CenterY + $InnerY),
        [System.Drawing.PointF]::new($CenterX - $OuterX, $CenterY),
        [System.Drawing.PointF]::new($CenterX - $InnerX, $CenterY - $InnerY)
    )
    $Graphics.FillPolygon($Brush, $points)
}

function New-PwaIcon([int]$Size, [string]$Path) {
    $renderSize = 2048
    $bitmap = [System.Drawing.Bitmap]::new($renderSize, $renderSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.ScaleTransform(4, 4)

    $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.RectangleF]::new(0, 0, 512, 512),
        [System.Drawing.ColorTranslator]::FromHtml('#28213f'),
        [System.Drawing.ColorTranslator]::FromHtml('#0d1018'),
        45
    )
    $graphics.FillRectangle($background, 0, 0, 512, 512)

    $tilePath = New-RoundedPath 61 61 390 390 94
    $tileBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.RectangleF]::new(61, 61, 390, 390),
        [System.Drawing.ColorTranslator]::FromHtml('#29263d'),
        [System.Drawing.ColorTranslator]::FromHtml('#171b26'),
        45
    )
    $graphics.FillPath($tileBrush, $tilePath)
    $tilePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(26, 255, 255, 255), 2)
    $graphics.DrawPath($tilePen, $tilePath)

    $trackPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#4a435e'), 20)
    $trackPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $trackPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawEllipse($trackPen, 114, 114, 284, 284)

    $progressPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#a998ff'), 20)
    $progressPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $progressPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawArc($progressPen, 114, 114, 284, 284, -90, 295)

    $mainStarBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#f2efff'))
    Add-Star $graphics 256 256 91 91 20 22 $mainStarBrush
    $smallStarBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#91e4c5'))
    Add-Star $graphics 354 164 39 39 9 10 $smallStarBrush
    $dotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#c7bbff'))
    $graphics.FillEllipse($dotBrush, 146, 347, 18, 18)

    $graphics.Dispose()
    $background.Dispose()
    $tilePath.Dispose()
    $tileBrush.Dispose()
    $tilePen.Dispose()
    $trackPen.Dispose()
    $progressPen.Dispose()
    $mainStarBrush.Dispose()
    $smallStarBrush.Dispose()
    $dotBrush.Dispose()

    $outputBitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $outputGraphics = [System.Drawing.Graphics]::FromImage($outputBitmap)
    $outputGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $outputGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $outputGraphics.DrawImage($bitmap, 0, 0, $Size, $Size)
    $outputGraphics.Dispose()
    $outputBitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $outputBitmap.Dispose()
    $bitmap.Dispose()
}

$iconDirectory = Join-Path $PSScriptRoot '..\client\public\icons'
New-Item -ItemType Directory -Force -Path $iconDirectory | Out-Null
New-PwaIcon 192 (Join-Path $iconDirectory 'app-192.png')
New-PwaIcon 512 (Join-Path $iconDirectory 'app-512.png')
New-PwaIcon 180 (Join-Path $iconDirectory 'apple-touch-icon.png')
