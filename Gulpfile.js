var gulp = require('gulp');
var livereload = require('gulp-livereload');
var spawn = require('child_process').spawn;
var shell = require('gulp-shell');
var runSequence = require('run-sequence');

// create socket for www-data
// user that runs the gulp must be member of www-data to assign this group to socket
gulp.task('init', shell.task([
    'mkdir -p /tmp/fcgi',
    'chown :www-data /tmp/fcgi',
    'chmod g+s /tmp/fcgi',
  ])
);

gulp.task('watch', ['init'], function() {
    
    livereload.listen();
    gulp.watch('/tmp/fcgi/*', function(event) {
      lifereloader();
    });
    
    var fcgi; 
    var lifereloader;
    
    function startFcgi() {
      //  start fcgi
      var mask = process.umask(0002);
      fcgi = spawn("spawn-fcgi", ["-s", "/tmp/fcgi/socket", "-n",  "--", "./main"]);
      process.umask(mask);
      fcgi.stdout.on('data', function(data) {
	console.log(""+data);
      });
      fcgi.stderr.on('data', function(data) {
	console.log(""+data);
      });
      fcgi.addListener("exit", function (code) { 
	console.log("killed");
	startFcgi(); 
      });
      console.log("fcgi spawned");
    }
    
    
    startFcgi();
    // kill fcgi process
    gulp.watch('main').on('change', function() {
      console.log('main changed');
      var self = this, args = arguments;
      lifereloader = function() {
	livereload.changed.apply(self, args);
      }
      console.log("killing");
      process.kill(fcgi.pid);
    });
    
    // compile source
    gulp.watch('main.cpp').on('change', function() {
      console.log('main.cpp changed');
      gulp.start('compile');
    });
});

gulp.task('compile', shell.task(['g++ -std=c++11 main.cpp /usr/lib/x86_64-linux-gnu/libjsoncpp.so /usr/lib/libfcgi++.so /usr/lib/libfcgi.so && mv ./a.out main']));

gulp.task('default', function() {
  runSequence ('compile', 'watch');
});
