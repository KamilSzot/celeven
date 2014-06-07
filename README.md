==Prequisites==

    apt-get install g++ libfcgi-dev libjsoncpp-dev libboost-all-dev 
    apt-get nginx spawn-fcgi
    
    apt-get nodejs npm    # better yet, install latest version from source

==Some setup==

    sudo adduser myusername www-data
    npm install
    npm install gulp -g
    apt-get install 

===Confgure nginx to use fcgi===

Replace contents of `/etc/nginx/sites-available/default` with the contents of `nginx-site-config`

===Precompile headers===

Makes recompilation faster.

    g++ depends.h
    
===Run===

Compiles file `main.cpp` whenever it changes, relaunches spawn-fcgi, triggers livereload

    gulp
    
Go to http://localhost/ with browser (with livereload plugin and connect it).
Whenever you change main.cpp you'll see chagnes in browser.