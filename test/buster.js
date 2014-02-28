var config = module.exports;

config['jsosc tests: node'] = {
	rootPath: '..',
	environment: 'node',
	libs: 
		[ //'lib/jsosc.js'
		],
	tests:
		[ 'test/**/*.js'
		]
}
