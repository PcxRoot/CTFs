# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -sS -vvv --min-rate 1000 $IP

PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 62
80/tcp open  http    syn-ack ttl 61
```

```bash
sudo nmap -p 22,80 -Pn -n -sVC -v -oN versiones --min-rate 1000 $IP

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.7 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 57:2c:43:78:0c:d3:13:5b:8d:83:df:63:cf:53:61:91 (ECDSA)
|_  256 45:e1:3c:eb:a6:2d:d7:c6:bb:43:24:7e:02:e9:11:39 (ED25519)
80/tcp open  http    Apache httpd 2.4.59 ((Debian))
|_http-server-header: Apache/2.4.59 (Debian)
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
|_http-title: Did not follow redirect to /
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

## <font color=red>[~]</font> Entorno web

Cuando accedemos a la web encontramos una página en blanco con el mensaje:
```
You are logged in as guest:**********************************************************************

SSO cookie is protected with traditional military grade en**crypt**ion
```

Cuando vemos el código fuente de la página vemos lo siguiente:
```html
<p>You are logged in as guest:**********************************************************************
<p>SSO cookie is protected with traditional military grade en<b>crypt</b>ion
<!-- TODO remember to remove .bak files-->
```

Hay un comentario que nos da una pista sobre que existe algún archivo `.bak` (lo que podría ser alguna copia de seguridad o un archivo que, aunque fuese antiguo, puede tener información importante).

### <font color=red>[!]</font> Fuzzing

Para encontrar el archivo podemos hacer fuzzing sobre el servicio web en el directorio raíz.

```bash
ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-files.txt -u http://$(cat ip)/FUZZ.bak -fc 404

index.php
```

Encontramos un archivo `index.php.bak` (debemos recordar el `.bak`) el cual podemos descargar navegando hacia el recurso desde el navegador o usando `wget`, o si no queremos descargarlo podemos ver su contenido usando la herramienta `curl`.

```bash
# Desacargar desde la terminal
wget http://$IP/index.php.bak

# Ver el contenido sin descargarlo
curl http://$IP/index.php.bak
```

### <font color=red>[!]</font> `index.php.bak`

```php
<?php
include('config.php');

function generate_cookie($user,$ENC_SECRET_KEY) {
    $SALT=generatesalt(2);
    
    $secure_cookie_string = $user.":".$_SERVER['HTTP_USER_AGENT'].":".$ENC_SECRET_KEY;

    $secure_cookie = make_secure_cookie($secure_cookie_string,$SALT);

    setcookie("secure_cookie",$secure_cookie,time()+3600,'/','',false); 
    setcookie("user","$user",time()+3600,'/','',false);
}

function cryptstring($what,$SALT){

return crypt($what,$SALT);

}


function make_secure_cookie($text,$SALT) {

$secure_cookie='';

foreach ( str_split($text,8) as $el ) {
    $secure_cookie .= cryptstring($el,$SALT);
}

return($secure_cookie);
}


function generatesalt($n) {
$randomString='';
$characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
for ($i = 0; $i < $n; $i++) {
    $index = rand(0, strlen($characters) - 1);
    $randomString .= $characters[$index];
}
return $randomString;
}



function verify_cookie($ENC_SECRET_KEY){


    $crypted_cookie=$_COOKIE['secure_cookie'];
    $user=$_COOKIE['user'];
    $string=$user.":".$_SERVER['HTTP_USER_AGENT'].":".$ENC_SECRET_KEY;

    $salt=substr($_COOKIE['secure_cookie'],0,2);

    if(make_secure_cookie($string,$salt)===$crypted_cookie) {
        return true;
    } else {
        return false;
    }
}


if ( isset($_COOKIE['secure_cookie']) && isset($_COOKIE['user']))  {

    $user=$_COOKIE['user'];

    if (verify_cookie($ENC_SECRET_KEY)) {
        
	    if ($user === "admin") {
   
	        echo 'congrats: ******flag here******. Now I want the key.';

        } else {
        
	        $length=strlen($_SERVER['HTTP_USER_AGENT']);
	        print "<p>You are logged in as " . $user . ":" . str_repeat("*", $length) . "\n";
		    print "<p>SSO cookie is protected with traditional military grade en<b>crypt</b>ion\n";    
	    }

	} else { 

	    print "<p>You are not logged in\n";

	}

} else {

    generate_cookie('guest',$ENC_SECRET_KEY);
    
    header('Location: /');
}
?> 
```

En el código PHP podemos ver que lo primero que se hace es comprobar si existen las ***cookies*** `secure_cookie` y `user`. En caso contrario las crea usando el usuario `guest` y una clave (que seguramente tome del archivo `config.php`.

Si vemos la lógica principal del código, vemos que si el valor de la cookie `user` es `admin`, se nos muestra una *flag* y un nuevo reto que nos dice que ahora necesitamos buscar la clave.

Primero nos centraremos en conseguir el usuario `admin`. Y es que si tratamos de modificar la petición directamente, la cookie `secure_cookie` no será válida y no nos servirá, por lo que tenemos que tratar de generar nuestra propia ***cookie válida***.

La validación de la cookie que hace el *backend* es generar una cookie desde cero usando los datos: `usuario` y `clave_secreta`. El usuario podemos modificarlo, por lo que tan solo necesitamos la ***clave_secreta***, la cual podemos obtener a través de ***fuerza bruta***.

#### <font color=red>[-]</font> Pasos de creación de Cookie

##### <font color=red>[.]</font> `generate_cookie('guest', $ENC_SECRET_KEY);`

```php
function generate_cookie($user,$ENC_SECRET_KEY) {
    $SALT=generatesalt(2);
    
    $secure_cookie_string = $user.":".$_SERVER['HTTP_USER_AGENT'].":".$ENC_SECRET_KEY;

    $secure_cookie = make_secure_cookie($secure_cookie_string,$SALT);

    setcookie("secure_cookie",$secure_cookie,time()+3600,'/','',false); 
    setcookie("user","$user",time()+3600,'/','',false);
}
```

1. Llama a la función `generatesalt`, la cual devuelve una sal de 2 caracteres alfanuméricos aleatorios.
2. Genera un string con el formato `usuario:USER_AGENT:clave_secreta`.
3. Llama a la función `make_secure_cookie` pensándole el string y la sal, la cual devuelve la ***cookie hasheada***.
4. Genera las cookies que tomará el navegador con el tiempo de expiración y las rutas válidas.

##### <font color=red>[.]</font> `make_secure_cookie($text, $SALT);`

```php
function make_secure_cookie($text,$SALT) {

	$secure_cookie='';

	foreach ( str_split($text,8) as $el ) {
	    $secure_cookie .= cryptstring($el,$SALT);
	}

	return($secure_cookie);
}
```

Esta función divide el string que se le pasa como parámetro `$text` en segmentos de ***8*** caracteres. Y las pasa por la función `cryptstring($segmento, $SALT)`, la cual devuelve el resultado de pasar el segmento por la función de PHP `crypt`.

Al terminar, va concatenando el resultado para obtener la cookie final.

##### <font color=red>[.]</font> `verify_cookie($ENC_SECRET_KEY);`

```php
function verify_cookie($ENC_SECRET_KEY){

    $crypted_cookie=$_COOKIE['secure_cookie'];
    $user=$_COOKIE['user'];
    $string=$user.":".$_SERVER['HTTP_USER_AGENT'].":".$ENC_SECRET_KEY;

    $salt=substr($_COOKIE['secure_cookie'],0,2);

    if(make_secure_cookie($string,$salt)===$crypted_cookie) {
        return true;
    } else {
        return false;
    }
}
```

Esta función toma la cookie del navegador, obtiene el usuario (de la cookie `user`) y genera una nueva cookie con el mismo procedimiento. Si la cookie nueva generada es la misma que la que manda el navegador: ***ES VÁLIDA***.

#### <font color=red>[-]</font> Spoofing de Usuario

>Sabemos que el hash que se usa en la cookie segura es un conjunto de varios *strings* cifrados concatenados.

Como sabemos el *String* que se prepara antes de ser *cifrado*  (`usuario:User-Agent:Clave_secreta`), y el algoritmo de cifrado que se usa (***DES (Data Encryption Standard***)). Realmente no necesitamos la clave secreta para poder crear una cookie con el usuario que queramos ( en este caso `admin`).

Para ello, debemos de tener en cuenta que ***DES*** es un ***algoritmo de cifrado simétrico de bloques***. 

- ***DES*** siempre ***devuelve*** una cadena de ***13 caracteres***.
- ***DES*** toma bloques de ***8 caracteres como máximo***.
	- En el caso de que tenga menos de 8 caracteres, el algoritmo rellena con ***bytes nulos*** hasta llegar a 8.
	- En el caso de que tenga más de 8 caracteres, el algoritmo trunca la cadena en el octavo carácter y desecha el resto (por eso se divide la cadena en segmentos de 8 caracteres).

Dentro de la comprobación de la cookie, nosotros podemos controlar el ***usuario*** y el ***User-Agent***, pero no la clave secreta. No obstante, podemos modificar estos componentes haciendo que el *payload* tenga una longitud de 8 caracteres exactos, haciendo que el primer bloque cifrado corresponda al ***usuario*** y ***User-Agent*** y el resto a la clave secreta.

>[!Warning]
>1. Debemos de hacer que el servidor genere una cookie cifrada con el usuario por defecto `guest` y un ***User-Agent modificado***.
>   
>   La idea es hacer que la longitud de la cadena con el formato `admin:{USER-AGENT}:` tenga exactamente ***8 caracteres***. *8 - ( 5 (`guest`) + 2 (`::`)) = 8 - 7 = 1*. Necesitamos un ***User-Agent*** de ***UN CARÁCTER***.
>   
>   ```bash
>   curl http://$IP/ -i -H "User-Agent: A"  # Puede ser cualquier otro caracter
>   ```
>   
>   Esto nos devolverá una cookie cifrada de la cual sacamos dos aspectos fundamentales:
>   1. Obtenemos la ***SAL***.
>   2. Obtenemos una cookie cifrada de la cual sabemos que el primer segmento cifrado corresponde al ***usuario*** y ***User-Agent*** y el resto a la clave secreta.
>   
>3. Teniendo la ***sal***, podemos cifrar nuestro *payload* usando al misma función de php:
>   ```bash
>   php -r "echo crypt('admin:A:', {SAL}) . \"\n\" ;"
>   
>   # Nos devuelve un segmento cifrado que corresponde a la cadena "admin:A:"
>   ```
>   
>   Como `admin` tiene el mismo número de caracteres que `guest` podemos usar el mismo ***User-Agent***, con lo que obtendremos una cadena cifrada válida para el servidor habiendo reemplazado el usuario `guest` por `admin`.
>   
>***Bonus***: Si hubieramos preferido usar ***Python***, podríamos hacer lo mismo con el siguiente comando:
>```python
>python3 -c "from passlib.hash import des_crypt; print(des_crypt.using(salt='SALT').hash('admin:A:'))
># Reemplazar SALT por la sal que obtuvimos anteriormente
>```
