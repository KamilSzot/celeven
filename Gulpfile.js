var stream = require('stream');
var gulp = require('gulp');
var livereload = require('gulp-livereload');
var spawn = require('child_process').spawn;
var shell = require('gulp-shell');
var runSequence = require('run-sequence');
var sqlite = require('sqlite3').verbose();
var Q = require('q');
var split = require('split');
var es = require("event-stream");
var gulpFilter = require("gulp-filter");
var watch = require("gulp-watch");
var less = require('gulp-less');
var plumber = require('gulp-plumber');
var runSequence = require('gulp-run-sequence');
var fs = require('fs');

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

gulp.task('compile', shell.task(['g++ -std=c++11 main.cpp '+require('./linker-deps.js').linkerDeps.map(function(fileName) { return '"'+fileName+'"'; }).join(" ") +' -o main']));

gulp.task('default', function() {
  runSequence ('compile', 'watch');
});


function cmd(paramsFactory) {
  return es.map(function(file, next) {
    if(!file.path) {
      next();
      return
      
    }
    var stdin = new stream.PassThrough;
    
    var params = paramsFactory(file);
    var child = spawn.apply(global, params);
    
    var bufs = [];
    child.stdout.on('data', function(buf) {
      bufs.push(buf);
    });
    child.stdout.on('end', function() {
      file.contents = Buffer.concat(bufs);
      next(null, file);
    });
// 	console.log(params[0]+" "+file.path);
    if(params[2] && params[2].input) {
//  	  console.log(params[2].input);
      
      child.stdin.end(params[2].input);
    };

  });
};


gulp.task('compile-to-object-file', shell.task(['g++ -std=c++11 -c main.cpp -o main.o']));

gulp.task('collect-deps', ['compile-to-object-file'], function(done) {
  var db = new sqlite.Database('libs.sqlite');
  db.serialize(function() {
    db.run('CREATE TABLE IF NOT EXISTS deps (symbol TEXT)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS uni ON deps (symbol)');
    
    console.log('begin');
    db.run("BEGIN TRANSACTION");
    var stmt = db.prepare("INSERT OR IGNORE INTO deps VALUES (?)");

    gulp.src('main.o', { read: false })
      .pipe(cmd(function(file) {  return ['nm', ['--undefined-only', '-A', file.path]] }))
      .pipe(cmd(function(file) { return ['awk', ["{print $3}"], { input: file.contents }]; }))
      .pipe(es.map(function(file, next) {
	    file.contents.toString().split("\n").forEach(function(line) {
	      line = line.trim();
	      if(line) {
// 		  console.log( file.path + " " + line );
		  stmt.run(line.toString('ascii'));
	      }
	    });
	    next(null, file)
      }))
//      .pipe(output())
      .on('end', function() {
	    console.log('commit');
	    db.run("COMMIT", function() {
	      stmt.finalize();
	      db.close(done);
	    });
      })
  });
});

gulp.task('deps', function(done) {
  runSequence('collect-libs', 'collect-deps', function() {
    var db = new sqlite.Database('libs.sqlite');
    var libs = [];
    db.each("\
      SELECT path FROM deps\
      JOIN libs USING(symbol)\
      WHERE symbol NOT IN (\
	SELECT symbol FROM libs\
	WHERE path = '/usr/lib/x86_64-linux-gnu/libc.a'\
      )\
      GROUP BY path\
      ORDER BY path\
    ", function(err, row) {
      libs.push(row.path);
    }, function() {
      var linkerDepsFile = fs.createWriteStream('linker-deps.js');
      linkerDepsFile.end("exports.linkerDeps = " + JSON.stringify(libs.map(function(path) { return path.replace(/\.a$/g, '.so'); })) + ';',  done);
    });
  });
});

// SELECT DISTINCT(path) FROM deps JOIN libs USING(symbol) ORDER BY path;
/*
SELECT path
FROM deps 
JOIN libs USING(symbol) 
WHERE symbol NOT IN (
  SELECT symbol 
  FROM libs 
  WHERE 
    path =
      '/usr/lib/x86_64-linux-gnu/libc.a'
)
GROUP BY path
ORDER BY path;
*/

gulp.task('collect-libs', function(done) {
  var skipPaths = /\/(ghc.*?|python2.7|syslinux\/com32|gcc)\/|\/libpthread.a$/;
  
  var db = new sqlite.Database('libs.sqlite');
  db.serialize(function() {
    db.run('CREATE TABLE IF NOT EXISTS libs (path TEXT, symbol TEXT)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS uni ON libs (symbol, path)');
  
    console.log('begin');
    db.run("BEGIN TRANSACTION");
    var stmt = db.prepare("INSERT OR IGNORE INTO libs VALUES (?, ?)");
    

//       gulp.src([
// 	'/usr/lib/**/*.a', 
//       ], { read: false })

    // gulp.src can't skip unaccessible directories
    var find = spawn("find", ["/usr/lib", "-name", "*.a"]);
    find.stderr.pipe(process.stderr);
    find.stdout
      .pipe(split())
      .pipe(es.map(function (line, cb) {
	if(skipPaths.test(line)) {
	  return cb();
	}
	cb(null, { path: line }) 
      }))
      
      .pipe(cmd(function(file) {  return ['nm', ['--defined-only', '-A', file.path]] }))
      .pipe(cmd(function(file) { return ['awk', ["{print $3}"], { input: file.contents}]; }))
      .pipe(es.map(function(file, next) {
	  console.log(file.path);
	  file.contents.toString().split("\n").forEach(function(line) {
	    line = line.trim();
	    if(line) {
	      stmt.run(file.path, line.toString('ascii'));
	    }
	  });
	  next(null, file)
      }))
      .on('end', function() {
	    console.log('commit');
	    db.run("COMMIT", function() {
	      stmt.finalize();
	      db.close(done);
	    });
      })
      
  });
  
});

gulp.task('less', function() {
  var lessOnly = gulpFilter('**/*.less');
  watch({ glob: 'less/**/*', emitOnGlob: false })
    .pipe(lessOnly)
    .pipe(output())
    .pipe(plumber({ errorHandler: function(e) { console.log(e); }}))
    .pipe(less({}))
    .pipe(output())
    .pipe(gulp.dest('compiledLess'));
});


function output() {
  return es.map(function(file, next) {
    console.log(file.path);
    console.log("");
    console.log(file.contents.toString());
    next(null, file);
  });
}
