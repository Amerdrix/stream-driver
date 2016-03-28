require("babel-register");

var gulp = require("gulp");
var babel = require("gulp-babel");
var mocha = require('gulp-mocha')

gulp.task("mocha", function(){
  return gulp.src("test/*.js", {read: false})
    .pipe(mocha({reporter: 'spec'}))
});

gulp.task("build", function () {
  return gulp.src("src/stream-driver.js")
    .pipe(babel())
    .pipe(gulp.dest("dist"));
});


gulp.task('default', function(){
   gulp.watch(['src/**', 'test/**'], ['mocha']);
})
