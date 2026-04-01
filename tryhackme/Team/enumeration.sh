#!/bin/bash

# Configuración
BASE_URL="http://team.thm/scripts/script"

echo "[+] Iniciando escaneo directo de archivos..."
echo "----------------------------------------------------"

for ext in ".bak" ".txt.old" ".php.bak" ".save" ".tmp" ".old" ".sh.old" ".sh.bak" "~"; do	
        TARGET_URL="${BASE_URL}${ext}"
    
        # -s: Silent (no barra de progreso)
        # -o /dev/null: No queremos el cuerpo del archivo en pantalla
        # -w "%{http_code}": Solo imprime el código (200, 404, etc.)
        STATUS=$(curl -s -I -o /dev/null -w "%{http_code}" "$TARGET_URL")

        if [ "$STATUS" -eq 200 ]; then
		echo "----------------------------------------------------"
                echo "[!] ¡ENCONTRADO!: $TARGET_URL (Status: $STATUS)"
        	echo "[+] Descargando contenido para análisis..."
        	curl -s "$TARGET_URL" > "descubierto${ext}"
        	echo "----------------------------------------------------"
    	elif [ "$STATUS" -eq 403 ]; then
        	echo "[?] Prohibido (403): $TARGET_URL - El archivo existe pero no tienes permisos."
    	else
        	echo "[-] No encontrado (404): ${ext}"
    	fi
done

echo "----------------------------------------------------"
echo "[+] Escaneo finalizado."
