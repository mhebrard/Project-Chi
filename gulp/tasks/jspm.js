import gulp from 'gulp';

import jspm from 'jspm';
import runSequence from 'run-sequence';
import gutil from 'gulp-util';
import replace from 'gulp-replace';
import {obj as throughObj} from 'through2';
import execa from 'execa';
import mkdirp from 'mkdirp';
import {loadSourceMap, computeGeneratedFileSizes, adjustSourcePaths} from 'source-map-explorer';

import config from '../config';

const paths = config.paths;

// jspm-bundles
Object.keys(config.builder.bundles).forEach(b => {
  gulp.task(`jspm-${b}`, () => {
    const builder = new jspm.Builder('./');
    builder.config(config.builder.config);
    return builder.bundle(config.builder.bundles[b], `${paths.temp}/${paths.bundles}/${b}.js`, config.builder.bundle);
  });
});

// copy bundles to dist folder
gulp.task('jspm-copy-bundles', () => {
  return gulp.src([`${paths.temp}/${paths.bundles}/*.{js,map,html}`], {base: paths.temp})
    .pipe(gulp.dest(paths.dist));
});

// need to fix relative URLS in css
gulp.task('jspm-copy-bundles-css', () => {
  return gulp.src([`${paths.temp}/${paths.bundles}/*.css`], {base: paths.temp})
    .pipe(replace(`url('/../jspm_packages/`, `url('../jspm_packages/`))  // fix relative paths in css
    .pipe(gulp.dest(paths.dist));
});

gulp.task('jspm-copy-config', () => {
  return gulp.src(paths.systemConfig)
    .pipe(gulp.dest(paths.dist));
});

function generateTreemap () {
  return throughObj((file, encoding, callback) => {
    gutil.log(`Generating treemap for ${gutil.colors.magenta(file.relative)}`);

    if (typeof loadSourceMap !== 'undefined') {
      const data = loadSourceMap(file.path, `${file.path}.map`);
      const sizes = computeGeneratedFileSizes(data.mapConsumer, data.jsData);
      const asizes = adjustSourcePaths(sizes, true, '', '');
      const tsv = 'Source\tSize\n' + Object.keys(asizes).map(k => `${k}\t${asizes[k]}`).join('\n');

      file.contents = new Buffer(tsv);
      file.path = gutil.replaceExtension(file.path, '.tsv');
      return callback(null, file);
    }

    gutil.log('Running source-map-explorer in shell');
    execa.stdout('source-map-explorer', ['--tsv', file.path, `${file.path}.map`])
      .then(result => {
        file.contents = new Buffer(result);
        file.path = gutil.replaceExtension(file.path, '.tsv');
        callback(null, file);
      })
      .catch(err => {
        console.error(err); // eslint-disable-line no-console
        callback(err);
      });
  });
}

gulp.task('jspm-treemaps', () => {
  gulp.src(`${config.paths.temp}/${config.paths.bundles}/*.js`, {read: false})
    .pipe(generateTreemap())
    .pipe(gulp.dest(`${config.paths.dist}/${config.paths.bundles}`));
});

gulp.task('jspm-mkdir', cb => {
  mkdirp(`${paths.temp}/${paths.bundles}/`, cb);
});

gulp.task('jspm-build-app', cb => {
  runSequence('jspm-app-bundle',
              ['jspm-copy-config', 'jspm-copy-bundles', 'jspm-copy-bundles-css', 'jspm-treemaps'],
              cb);
});

gulp.task('jspm-dev-build', cb => {
  runSequence(
    'jspm-mkdir',
    'jspm-deps-bundle',
  cb);
});

gulp.task('jspm-build', cb => {
  runSequence(
    'jspm-mkdir',
    'jspm-deps-bundle',
    'jspm-build-app',
  cb);
});
