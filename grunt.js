module.exports = function (grunt) {

    grunt.initConfig({
        pkg   :'<json:package.json>',
        meta  :{
            bannerLite:'/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
                '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
                '* <%= pkg.homepage %>\n' +
                '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
                ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %>*/\n'
        },
        concat:{
            lite:{
                src:[
                    'src/jsRocket.js',
                    'src/syncdata.js',
                    'src/synctrack.js',
                    'src/syncdeviceplayer.js',
                    'src/syncdevice.js'],
                dest:'build/<%= pkg.name %>.sans-socket.js'
            },
            dist:{
                src:[
                    'src/jsRocket.js',
                    'src/syncdata.js',
					'src/synctrack.js',
					'src/syncdeviceplayer.js',
					'src/syncdeviceclient.js',
					'src/syncdevice.js'],
                dest:'build/<%= pkg.name %>.js'
            }
        },
        min   :{
            lite:{
                src :['<banner:meta.bannerLite>', '<config:concat.lite.dest>'],
                dest:'build/<%= pkg.name %>.sans-socket.min.js'
            },
            dist:{
                src :['<banner:meta.bannerLite>', '<config:concat.dist.dest>'],
                dest:'build/<%= pkg.name %>.min.js'
            }
        },
        lint  :{
            files:['grunt.js', '<config:concat.dist.src>']
        },
        jshint:{
            options:{
                plusplus:false,
                curly  :true,
                bitwise:false,
                eqeqeq :true,
                immed  :true,
                latedef:true,
                newcap :true,
                noarg  :true,
                sub    :true,
                undef  :true,
                boss   :true,
                eqnull :true,
                browser:true,
                devel:true
            },
            globals:{
                'JSRocket':true,
                module :false
            }
        }
    });

    grunt.registerTask('default', 'concat lint min');
};
