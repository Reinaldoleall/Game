#!/bin/bash
echo "🚀 Otimizando assets para WebView Android..."

# 1. Comprime GIFs (80% redução)
echo "Comprimindo GIFs..."
for gif in *.gif; do
    if [ -f "$gif" ]; then
        gifsicle -O3 --lossy=80 "$gif" -o "temp_$gif"
        mv "temp_$gif" "$gif"
        echo "  ✓ $gif otimizado"
    fi
done

# 2. Comprime PNGs (70% redução)
echo "Comprimindo PNGs..."
for png in *.png; do
    if [ -f "$png" ]; then
        pngquant --quality=60-85 --ext .png --force "$png"
        echo "  ✓ $png otimizado"
    fi
done

# 3. Minifica HTML
echo "Minificando HTML..."
if [ -f "index.html" ]; then
    # Remove comentários, espaços extras
    sed -i '' 's/<!--.*-->//g' index.html
    tr -d '\n' < index.html | tr -s ' ' > temp.html
    mv temp.html index.html
    echo "  ✓ HTML minificado"
fi

# 4. Remove imagens não usadas (ajuste a lista)
echo "Removendo arquivos não usados..."
UNUSED_FILES=("natureza.png" "nuvens.png" "nuvenss.png") # Exemplo
for file in "${UNUSED_FILES[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "  ✗ $file removido"
    fi
done

# 5. Converte para WebP (Android suporta nativamente)
echo "Convertendo para WebP (opcional)..."
# cwebp -q 80 imagem.png -o imagem.webp

echo "✅ Otimização completa!"
echo "📊 Tamanho final da pasta assets:"
du -sh .