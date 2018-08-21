import test from 'blue-tape';

const joi = require('joi');

const transformable = joi.array();
const transformableOr = type => joi.alternatives().try([type, transformable]);

const assetTypeMinimum = joi.object().keys({
  rid: joi.string().required(),
  id: joi.string().required(),
});
const widgetMenuItem = joi.object().keys({
  label: transformableOr(joi.string()).required(),
  icon: joi.string(),
  method: transformable.required(),
});
const widget = {
  id: joi.string(),
  component: joi.string().required(),
  align: joi.string(),
  justify: joi.string(),
  responsive: joi.boolean(),
  frameProps: joi.object({
    title: transformableOr(joi.string()),
    menuItems: joi.array().items(widgetMenuItem),
  }),
  contentProps: joi.object(),
  hoc: transformable,
};
const assetType = assetTypeMinimum.keys({
  channels: joi.object().pattern(joi.any(), joi.string()),
  rpcs: joi.object().pattern(joi.any(), joi.string()),
  widgetsInDashboard: joi.array().items(joi.string(), joi.number()),
  widgets: joi.array().items(widget),
});
// import Deepstream from 'deepstream.io';
// import getClient from 'extended-ds-client';
// import Service, { createRpcService, typeAssert } from '../src/index';

// const dss = new Deepstream();
// let c;
// let s;
// const serviceName = 'testService';

// const options = {
//   // Reconnection procedure: R 1s R 2s R 3s ... R 8s R 8s ...
//   reconnectIntervalIncrement: 1000,
//   maxReconnectInterval: 8000,
//   maxReconnectAttempts: Infinity,
// };

// test('Set up', async t => {
//   dss.start();
//   c = getClient('localhost:6020', options);
//   c.on('error', e => console.log('Test-client Error:', e));
//   c.login({ id: 'testClient' });
//   await c.rpc.p.make(`${serviceName}/testFunction`, rpcData);
//   t.equal(signal, 1);
// });

// const myMethod = args => {
//   // console.log(myFunc.prototype.propTypes);
//   PropTypes.checkPropTypes(myFunc.propTypes, args);
//   return args;
// };

test('Try joi 1', async t => {
  const schema = joi
    .object()
    .keys({
      username: joi
        .string()
        .alphanum()
        .min(3)
        .max(30)
        .required(),
      password: joi.string().regex(/^[a-zA-Z0-9]{3,30}$/),
      access_token: [joi.string(), joi.number()],
      birthyear: joi
        .number()
        .integer()
        .min(1900)
        .max(2013),
      email: joi.string().email({ minDomainAtoms: 2 }),
    })
    .with('username', 'birthyear')
    .without('password', 'access_token');

  // console.log('schema:', schema);

  // Return result.
  const result = joi.validate({ username: 'abc', birthyear: 1994 }, schema);
  t.equals(result.error, null);
  // result.error === null -> valid

  // You can also pass a callback which will be called synchronously with the validation result.
  joi.validate({ username: 'abc', birthyear: 1994 }, schema); // err === null -> valid
  t.ok(true);
});

test('Try joi 1', async t => {
  joi.validate(
    {
      widgetsInDashboard: [
        'gasSpring3d',
        'pressureGauge',
        'pressureChart',
        'heatMapVideo',
        'heatNumbers',
        'heatChart',
        'lampController',
        7,
        8,
        9,
        10,
        11,
        12,
      ],
      widgets: [
        {
          id: 'gasSpring3d',
          component: 'Spring3d',
          frameProps: {
            title: ['%t%', 'gasSpring'],
          },
          withChannelDataConf: {
            pressure: {
              init: 5.5,
              subs: [{ rid: ['%channel%', 'pressure'], path: 'pl[0]' }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: {
            restPressure: 5.5,
            maxPressure: 8.5,
            threshold: 5.8,
          },
        },
        {
          id: 'heatMapVideo',
          component: 'Image',
          frameProps: {
            title: ['%t%', 'camera'],
          },
          withChannelDataConf: {
            src: {
              subs: [{ rid: ['%channel%', 'video'], path: 'pl[1]' }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: { blackBackground: true },
        },
        {
          id: 'pressureGauge',
          component: 'GaugeAnimated',
          frameProps: {
            title: ['%t%', 'pressure'],
          },
          withChannelDataConf: {
            value: {
              init: 0,
              subs: [{ rid: ['%channel%', 'pressure'], path: 'pl[0]' }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: {
            valueDisplayDecimals: 1,
            size: 200,
            faceText: 'bar',
            max: 10,
            min: 2,
            stepValue: 0.02,
            mediumSteps: 10,
            largeSteps: 50,
            labelSteps: 50,
            valueDisplay: true,
            fontFamily: ' ',
            scaleLabelFontFamily: ' ',
            faceTextFontFamily: ' ',
            valueDisplayFontFamily: ' ',
            markerWidths: [
              '%ml%',
              [
                'fn',
                ['step'],
                [
                  'if',
                  ['=', ['%', 'step', 50], 1],
                  1.5,
                  ['if', ['=', ['%', 'step', 10], 0], 1.5, 2.5],
                ],
              ],
            ],
            markerLength: 12,
            markerColors: [
              '%ml%',
              [
                'fn',
                ['step'],
                [
                  'if',
                  ['=', ['%', 'step', 10], 0],
                  ['`', 'black'],
                  [
                    'if',
                    ['or', ['<', 'step', 80], ['>', 'step', 270]],
                    ['`', '#ef5350'],
                    [
                      'if',
                      ['and', ['>', 'step', 80], ['<', 'step', 120]],
                      ['`', '#FFD740'],
                      [
                        'if',
                        ['and', ['>', 'step', 230], ['<=', 'step', 270]],
                        ['`', '#FFD740'],
                        ['`', '#00E676'],
                      ],
                    ],
                  ],
                ],
              ],
            ],

            // needleSvg: [ // TODO: WIP!! Use zipWith + reduce(concat) ?
            //   '%ml%',
            //   [
            //     'fn',
            //     ['size'],
            //     [
            //       'let',
            //       ['c', 250],
            //       [
            //         'stringToElement',
            //         [
            //           '.',
            //           'R',
            //           ['`', 'concat'],
            //           ['`', '<svg viewBox="0 0 '],
            //           'size',
            //           ['`', ' '],
            //           'size',
            //           ['`', '" xmlns="http://www.w3.org/2000/svg" style="width:'],
            //           ['`', 'px; height:'],
            //           ['`', 'px;"><g><g transform="scale('],
            //           ['`', ')"><circle cx="'],
            //           ['`', '" cy="'],
            //           ['`', '" r="20" style="fill:#000"/><path d="M '],
            //         ]
            //         size size'" xmlns="http://www.w3.org/2000/svg" style="width:${size}px; height:${size}px;">'
            //     <g>
            //       <g transform="scale(${scale})">
            //         <circle cx="${c}" cy="${c}" r="20" style="fill:#000"/>
            //         <path d="M ${c - 50} ${c + 6} L ${c * 1.9} ${c + 2} L ${c * 1.9} ${c - 2} L ${c -
            //             50} ${c - 6} z" fill="#000" stroke="#111"/>
            //         <ellipse stroke="#000" ry="25" rx="18" id="svg_1" cy="${c}" cx="${c -
            //             60}" fill="#000"/>
            //         <ellipse stroke="#FFF" ry="18" rx="15" id="svg_2" cy="${c}" cx="${c -
            //             66}" fill="#FFF" stroke="#FFF"/>
            //       </g>
            //     </g>
            //   </svg>
            // `,
            //         ],
            //       ],
            //     ],
            //   ],
            // ],

            // needleSvg: size => {
            //   const c = 250;
            //   const scale = size / 500;
            //   return stringToElement(`
            //     <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="width:${size}px; height:${size}px;">
            //       <g>
            //         <g transform="scale(${scale})">
            //           <circle cx="${c}" cy="${c}" r="20" style="fill:#000"/>
            //           <path d="M ${c - 50} ${c + 6} L ${c * 1.9} ${c + 2} L ${c * 1.9} ${c - 2} L ${c -
            //     50} ${c - 6} z" fill="#000" stroke="#111"/>
            //           <ellipse stroke="#000" ry="25" rx="18" id="svg_1" cy="${c}" cx="${c -
            //     60}" fill="#000"/>
            //           <ellipse stroke="#FFF" ry="18" rx="15" id="svg_2" cy="${c}" cx="${c -
            //     66}" fill="#FFF" stroke="#FFF"/>
            //         </g>
            //       </g>
            //     </svg>
            //   `);
            // },
            // labelDivider: 1,
            labelRadius: 1.15,
            font: '28px arial',
          },
        },
        {
          id: 'pressureChart',
          component: 'RealtimeChart',
          responsive: true,
          frameProps: {
            title: ['%t%', 'pressureOverTime'],
          },
          withChannelDataConf: {
            payload: {
              init: [['%ml%', ['new', 'Date']], 0],
              transform: ['%ml%', ['.-', 'utils', ['`', 'ctToPl']]],
              subs: [{ rid: ['%channel%', 'pressure'] }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: {
            // options: { animation: { duration: 1000 } },
            length: 30,
            data: {
              labels: [['%ml%', ['new', 'Date']]],
              datasets: [
                {
                  label: ['%t%', 'pressure'],
                  data: [0],
                  fill: false,
                },
              ],
            },
          },
        },
        {
          id: 'lampController',
          component: 'LampController',
          align: 'top',
          setModeCallback: [
            '%ml%',
            [
              'fn',
              ['path', 'mode'],
              [
                'fn',
                [],
                [
                  'rpcMake',
                  'path',
                  [
                    '.',
                    'R',
                    ['`', 'objOf'],
                    ['`', 'config'],
                    ['.', 'R', ['`', 'objOf'], ['`', 'mode'], 'mode'],
                  ],
                ],
              ],
            ],
          ],
          frameProps: {
            title: ['%t%', 'lampController'],
            menuItems: [
              {
                label: 'Trigger mode: std',
                icon: 'wb_incandescent',
                method: [
                  '%ml%',
                  [
                    ['get', ['`', 'setModeCallback']],
                    ['`', ['%inAsset%', 'rpcs.setTriggerMode']],
                    ['`', 'std'],
                  ],
                ],
              },
              {
                label: 'Trigger mode: light',
                icon: 'brightness_6',
                method: [
                  '%ml%',
                  [
                    ['get', ['`', 'setModeCallback']],
                    ['`', ['%inAsset%', 'rpcs.setTriggerMode']],
                    ['`', 'light'],
                  ],
                ],
              },
              {
                label: 'Trigger mode: pir',
                icon: 'directions_run',
                method: [
                  '%ml%',
                  [
                    ['get', ['`', 'setModeCallback']],
                    ['`', ['%inAsset%', 'rpcs.setTriggerMode']],
                    ['`', 'pir'],
                  ],
                ],
              },
              {
                label: 'Mode: cool_lights',
                icon: 'wb_iridescent',
                method: [
                  '%ml%',
                  [
                    ['get', ['`', 'setModeCallback']],
                    ['`', ['%inAsset%', 'rpcs.setMode']],
                    ['`', 'cool_lights'],
                  ],
                ],
              },
              {
                label: 'Mode: alarm_pulse',
                icon: 'filter_tilt_shift',
                method: [
                  '%ml%',
                  [
                    ['get', ['`', 'setModeCallback']],
                    ['`', ['%inAsset%', 'rpcs.setMode']],
                    ['`', 'alarm_pulse'],
                  ],
                ],
              },
              {
                label: 'Mode: temp_change',
                icon: 'wb_sunny',
                method: [
                  '%ml%',
                  [
                    ['get', ['`', 'setModeCallback']],
                    ['`', ['%inAsset%', 'rpcs.setMode']],
                    ['`', 'temp_change'],
                  ],
                ],
              },
              {
                label: 'Mode: alarm_snake',
                icon: 'gesture',
                method: [
                  '%ml%',
                  [
                    ['get', ['`', 'setModeCallback']],
                    ['`', ['%inAsset%', 'rpcs.setMode']],
                    ['`', 'alarm_snake'],
                  ],
                ],
              },
              {
                label: 'End mode',
                icon: 'keyboard_tab',
                method: ['%ml%', ['fn', [], ['rpcMake', ['`', ['%inAsset%', 'rpcs.endMode']]]]],
              },
            ],
          },
          contentProps: {
            ids: ['0', '2', '4', '6', '1', '3', '5', '7'],
            rpcPaths: ['%inAsset%', 'rpcs'],
          },
          withChannelDataConf: {
            lampStatus: {
              subs: [{ rid: ['%channel%', 'lampStates'], path: 'pl[0]' }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
        },
        {
          id: 'heatNumbers',
          component: 'CounterMeter',
          frameProps: {
            title: ['%t%', 'thermalCamera'],
          },
          withChannelDataConf: {
            values: {
              init: [0, 0],
              subs: [{ rid: ['%channel%', 'temperature2'], path: 'pl', last: true }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: {
            config: [
              {
                label: ['%t%', 'minTemperature'],
                decimals: 1,
                unit: '°C',
              },
              {
                label: ['%t%', 'maxTemperature'],
                decimals: 1,
                unit: '°C',
              },
            ],
          },
        },
        {
          id: 'heatChart',
          component: 'RealtimeChart',
          responsive: true,
          frameProps: {
            title: ['%t%', 'thermalCameraOverTime'],
          },
          withChannelDataConf: {
            payload: {
              init: [['%ml%', ['new', 'Date']], 0, 0],
              transform: ['%ml%', ['.-', 'utils', ['`', 'ctToPl']]],
              subs: [{ rid: ['%channel%', 'temperature2'] }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: {
            data: {
              labels: [['%ml%', ['new', 'Date']]],
              datasets: [
                {
                  label: ['%t%', 'minTemperature'],
                  data: [0],
                  fill: false,
                },
                {
                  label: ['%t%', 'maxTemperature'],
                  data: [0],
                  fill: false,
                },
              ],
            },
          },
        },
        {
          id: 'temperatureGauge',
          component: 'ColorGauge',
          frameProps: {
            title: ['%t%', 'temperature'],
            tooltip: ['%t%', 'springTemperatureInfo', 'msg'],
          },
          withChannelDataConf: {
            value: {
              init: 0,
              subs: [{ rid: ['%channel%', 'temperature'], path: 'pl[0]', last: true }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: {
            size: 220,
            min: 0,
            max: 100,
            valueDisplayDecimals: 1,
            markerColors: [
              '%ml%',
              [
                'fn',
                ['step'],
                [
                  'if',
                  ['>', 'step', 80],
                  ['`', '#ef5350'],
                  [
                    'if',
                    ['and', ['>=', 'step', 75], ['<=', 'step', 80]],
                    ['`', '#FFD740'],
                    ['`', '#00E676'],
                  ],
                ],
              ],
            ],
          },
        },
        {
          id: 'temperatureChart',
          component: 'RealtimeChart',
          responsive: true,
          frameProps: {
            title: ['%t%', 'temperatureOverTime'],
            tooltip: ['%t%', 'springTemperatureInfo', 'msg'],
          },
          withChannelDataConf: {
            payload: {
              init: [['%ml%', ['new', 'Date']], 0],
              transform: ['%ml%', ['.-', 'utils', ['`', 'ctToPl']]],
              subs: [{ rid: ['%channel%', 'temperature'], last: true }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: {
            data: {
              labels: [['%ml%', ['new', 'Date']]],
              datasets: [
                {
                  label: ['%t%', 'minTemperature'],
                  data: [0],
                  fill: false,
                },
                {
                  label: ['%t%', 'maxTemperature'],
                  data: [0],
                  fill: false,
                },
              ],
            },
          },
        },
        {
          id: 'accelerometerChart',
          component: 'RealtimeChart',
          responsive: true,
          frameProps: {
            title: ['%t%', 'accelerometerMs'],
          },
          withChannelDataConf: {
            payload: {
              init: [['%ml%', ['new', 'Date']], 0, 0, 0],
              transform: ['%ml%', ['.-', 'utils', ['`', 'ctToPl']]],
              subs: [{ rid: ['%channel%', 'acceleration'] }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: {
            length: 120,
            data: {
              labels: [['%ml%', ['new', 'Date']]],
              datasets: [
                {
                  label: ['%t%', 'x'],
                  data: [0],
                  fill: false,
                },
                {
                  label: ['%t%', 'y'],
                  data: [0],
                  fill: false,
                },
                {
                  label: ['%t%', 'z'],
                  data: [0],
                  fill: false,
                },
              ],
            },
          },
        },
        {
          id: 'soundSpectrum',
          component: 'RealtimeChart',
          responsive: true,
          frameProps: {
            title: ['%t%', 'soundSpectrum'],
          },
          // initGlobalState: ['asset', 'readNotifications', [...]],
          // whatever: ['%ml%', ['.', 'asset', 'readNotifications', 'asset', ['%asset%', 'rid'], 10]]
          withChannelDataConf: {
            payload: {
              init: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              subs: [{ rid: ['%channel%', 'frequencySpectrum'], path: 'pl' }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: {
            length: 0,
            type: 'bar',
            data: {
              labels: ['30', '60', '120', '240', '480', '960', '1920', '3840', '7680', '15360'],
              datasets: [{ label: ['%t%', 'frequencies'], data: [0] }],
            },
          },
        },
        {
          id: 'soundSpectrumChart',
          component: 'RealtimeChart',
          responsive: true,
          frameProps: {
            title: ['%t%', 'soundSpectrum'],
          },
          withChannelDataConf: {
            payload: {
              init: [['%ml%', ['new', 'Date']], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              transform: ['%ml%', ['.-', 'utils', ['`', 'ctToPl']]],
              subs: [{ rid: ['%channel%', 'frequencySpectrum'] }],
            },
          },
          hoc: ['%ml%', ['withChannelData', ['get', ['`', 'withChannelDataConf']]]],
          contentProps: {
            data: {
              labels: [['%ml%', ['new', 'Date']]],
              datasets: [
                { label: '30', data: [0], fill: false },
                { label: '60', data: [0], fill: false },
                { label: '120', data: [0], fill: false },
                { label: '240', data: [0], fill: false },
                { label: '480', data: [0], fill: false },
                { label: '960', data: [0], fill: false },
                { label: '1920', data: [0], fill: false },
                { label: '3840', data: [0], fill: false },
                { label: '7680', data: [0], fill: false },
                { label: '15360', data: [0], fill: false },
              ],
            },
          },
        },
        {
          id: 'notifications',
          widget: 'notification',
          frameProps: {
            title: ['%t%', 'notifications'],
          },
          // keyChannelMap: {
          //   point: {
          //     init: {},
          //     channel: { type: 'notification' },
          //   },
          // },
          // config: {},
        },
      ],
    },
    assetType,
  );
  t.ok(true);
});

// test('Tear down', async t => {
//   s.close();
//   c.close();
//   dss.stop();
// });
