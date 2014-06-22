== Prequisites ==

    apt-get install g++ libfcgi-dev libjsoncpp-dev libboost-all-dev 
    apt-get nginx spawn-fcgi
    
    apt-get nodejs npm    # better yet, install latest version from source

== Some setup ==

    sudo adduser myusername www-data
    npm install
    npm install gulp -g
    apt-get install 

=== Confgure nginx to use fcgi ===

Replace contents of `/etc/nginx/sites-available/default` with the contents of `nginx-site-config`

=== Precompile headers ===

Makes recompilation faster.

    g++ depends.h
    
=== Determine what libs need to be linked ===

When your program uses 3rd party lib you need to know not only header file but also binary file that contains the lib.

    gulp deps
    
tries to collect all the libs you have in your system and all the dependedncies your program has and writes them to file `linker-deps.js`

If it doesn't work you can put library filenames in `linker-deps.js` manually.
    
=== Run ===

Compiles file `main.cpp` whenever it changes, relaunches spawn-fcgi, triggers livereload

    gulp
    
Go to http://localhost/ with browser (with livereload plugin and connect it).
Whenever you change main.cpp you'll see chagnes in browser.