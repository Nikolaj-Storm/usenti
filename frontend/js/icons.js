// Mr. Snowman - Icon Components

const { createElement: h } = React;

const Icon = ({ d, size = 24, className = "" }) => h('svg', {
  xmlns: "http://www.w3.org/2000/svg",
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className
}, typeof d === 'string' ? h('path', { d }) : d);

const Icons = {
  LayoutDashboard: (p) => Icon({...p, d: [
    h('rect', {key:1, width:"7", height:"9", x:"3", y:"3", rx:"1"}),
    h('rect', {key:2, width:"7", height:"5", x:"14", y:"3", rx:"1"}),
    h('rect', {key:3, width:"7", height:"9", x:"14", y:"12", rx:"1"}),
    h('rect', {key:4, width:"7", height:"5", x:"3", y:"16", rx:"1"})
  ]}),

  Send: (p) => Icon({...p, d: [
    h('path', {key:1, d:"m22 2-7 20-4-9-9-4Z"}),
    h('path', {key:2, d:"M22 2 11 13"})
  ]}),

  Users: (p) => Icon({...p, d: [
    h('path', {key:1, d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}),
    h('circle', {key:2, cx:"9", cy:"7", r:"4"}),
    h('path', {key:3, d:"M22 21v-2a4 4 0 0 0-3-3.87"})
  ]}),

  Plus: (p) => Icon({...p, d: [
    h('path', {key:1, d:"M5 12h14"}),
    h('path', {key:2, d:"M12 5v14"})
  ]}),

  Mail: (p) => Icon({...p, d: [
    h('rect', {key:1, width:"20", height:"16", x:"2", y:"4", rx:"2"}),
    h('path', {key:2, d:"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"})
  ]}),

  Layers: (p) => Icon({...p, d: [
    h('polygon', {key:1, points:"12 2 2 7 12 12 22 7 12 2"}),
    h('polyline', {key:2, points:"2 17 12 22 22 17"}),
    h('polyline', {key:3, points:"2 12 12 17 22 12"})
  ]}),

  Settings: (p) => Icon({...p, d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"}),

  LogOut: (p) => Icon({...p, d: [
    h('path', {key:1, d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}),
    h('polyline', {key:2, points:"16 17 21 12 16 7"}),
    h('line', {key:3, x1:"21", x2:"9", y1:"12", y2:"12"})
  ]}),

  Loader2: (p) => Icon({...p, className:`animate-spin ${p.className||''}`, d: "M21 12a9 9 0 1 1-6.219-8.56"}),

  X: (p) => Icon({...p, d: [
    h('path', {key:1, d:"M18 6 6 18"}),
    h('path', {key:2, d:"m6 6 12 12"})
  ]}),

  Upload: (p) => Icon({...p, d: [
    h('path', {key:1, d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}),
    h('polyline', {key:2, points:"17 8 12 3 7 8"}),
    h('line', {key:3, x1:"12", y1:"3", x2:"12", y2:"15"})
  ]}),

  Download: (p) => Icon({...p, d: [
    h('path', {key:1, d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}),
    h('polyline', {key:2, points:"7 10 12 15 17 10"}),
    h('line', {key:3, x1:"12", y1:"15", x2:"12", y2:"3"})
  ]}),

  AlertCircle: (p) => Icon({...p, d: [
    h('circle', {key:1, cx:"12", cy:"12", r:"10"}),
    h('line', {key:2, x1:"12", x2:"12", y1:"8", y2:"12"}),
    h('line', {key:3, x1:"12", x2:"12.01", y1:"16", y2:"16"})
  ]})
};
