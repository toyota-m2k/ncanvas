/**
 * demo.pug から、単一HTMLファイルを作成する
 */
const gulp = require('gulp');
const sass = require('gulp-sass');
const pug = require('gulp-pug');
//const uglify = require('gulp-htmlmin');
const uglify = require('gulp-minifier');
const rename = require('gulp-rename');

function sassCompile(option, rel) {
}

function pugCompile(option) {
}

gulp.task("sass", ()=> {
    return gulp.src("./views/**/!(_)*.scss")
               .pipe(sass({
                    sourceMap: true,
                    debug: true,
                    outputStyle: 'extended'
                }))
               .pipe(gulp.dest("./views"));
});

gulp.task("pug", ()=>{
    return gulp.src('./views/demo/*.pug')
               .pipe(pug({
                    pretty: true,
                    data: {
                        staticHtml: true,
                    }
                }))
               .pipe(gulp.dest('./views/demo'));
});

gulp.task("uglify", ()=>{
    return gulp.src('./views/demo/demo.html')
    .pipe(uglify({
        processScripts: ['text/x-template'],
        minifyJS: true,
        minifyCSS: true,
        collapseWhitespace: true,
        removeComments: true
    }))
    .pipe(rename({
        extname: '.min.html'
    }))
    .pipe(gulp.dest('./views/demo'))
});