// Mr. Snowman - Icon Library (Pure React, no JSX)

const Icon = ({ path, size = 24, className = "" }) => {
  return h('svg', {
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
  }, path);
};

const Icons = {
  LayoutDashboard: (p) => Icon({...p, path: [
    h('rect', {key:1, width:"7", height:"9", x:"3", y:"3", rx:"1"}),
    h('rect', {key:2, width:"7", height:"5", x:"14", y:"3", rx:"1"}),
    h('rect', {key:3, width:"7", height:"9", x:"14", y:"12", rx:"1"}),
    h('rect', {key:4, width:"7", height:"5", x:"3", y:"16", rx:"1"})
  ]}),

  Send: (p) => Icon({...p, path: [
    h('path', {key:1, d:"m22 2-7 20-4-9-9-4Z"}),
    h('path', {key:2, d:"M22 2 11 13"})
  ]}),

  Users: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}),
    h('circle', {key:2, cx:"9", cy:"7", r:"4"}),
    h('path', {key:3, d:"M22 21v-2a4 4 0 0 0-3-3.87"}),
    h('path', {key:4, d:"M16 3.13a4 4 0 0 1 0 7.75"})
  ]}),

  Settings: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"}),
    h('circle', {key:2, cx:"12", cy:"12", r:"3"})
  ]}),

  LogOut: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}),
    h('polyline', {key:2, points:"16 17 21 12 16 7"}),
    h('line', {key:3, x1:"21", x2:"9", y1:"12", y2:"12"})
  ]}),

  Layers: (p) => Icon({...p, path: [
    h('polygon', {key:1, points:"12 2 2 7 12 12 22 7 12 2"}),
    h('polyline', {key:2, points:"2 17 12 22 22 17"}),
    h('polyline', {key:3, points:"2 12 12 17 22 12"})
  ]}),

  Inbox: (p) => Icon({...p, path: [
    h('polyline', {key:1, points:"22 12 16 12 14 15 10 15 8 12 2 12"}),
    h('path', {key:2, d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"})
  ]}),

  ArrowUpRight: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M7 7h10v10"}),
    h('path', {key:2, d:"M7 17 17 7"})
  ]}),

  Mail: (p) => Icon({...p, path: [
    h('rect', {key:1, width:"20", height:"16", x:"2", y:"4", rx:"2"}),
    h('path', {key:2, d:"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"})
  ]}),

  MousePointer2: (p) => Icon({...p, path: h('path', {d:"m12 22-4-9-9-4 23-7-7 23Z"})}),

  MessageSquare: (p) => Icon({...p, path: h('path', {d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"})}),

  AlertCircle: (p) => Icon({...p, path: [
    h('circle', {key:1, cx:"12", cy:"12", r:"10"}),
    h('line', {key:2, x1:"12", x2:"12", y1:"8", y2:"12"}),
    h('line', {key:3, x1:"12", x2:"12.01", y1:"16", y2:"16"})
  ]}),

  ShieldCheck: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"}),
    h('path', {key:2, d:"m9 12 2 2 4-4"})
  ]}),

  Flame: (p) => Icon({...p, path: h('path', {d:"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3a9 9 0 0 0 3 3.3z"})}),

  Server: (p) => Icon({...p, path: [
    h('rect', {key:1, width:"20", height:"8", x:"2", y:"2", rx:"2", ry:"2"}),
    h('rect', {key:2, width:"20", height:"8", x:"2", y:"14", rx:"2", ry:"2"}),
    h('line', {key:3, x1:"6", x2:"6.01", y1:"6", y2:"6"}),
    h('line', {key:4, x1:"6", x2:"6.01", y1:"18", y2:"18"})
  ]}),

  Plus: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M5 12h14"}),
    h('path', {key:2, d:"M12 5v14"})
  ]}),

  RefreshCw: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}),
    h('path', {key:2, d:"M21 3v5h-5"}),
    h('path', {key:3, d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}),
    h('path', {key:4, d:"M8 16H3v5"})
  ]}),

  BarChart3: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M3 3v18h18"}),
    h('path', {key:2, d:"M18 17V9"}),
    h('path', {key:3, d:"M13 17V5"}),
    h('path', {key:4, d:"M8 17v-3"})
  ]}),

  Trash2: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M3 6h18"}),
    h('path', {key:2, d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"}),
    h('path', {key:3, d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"}),
    h('line', {key:4, x1:"10", x2:"10", y1:"11", y2:"17"}),
    h('line', {key:5, x1:"14", x2:"14", y1:"11", y2:"17"})
  ]}),

  Edit3: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M12 20h9"}),
    h('path', {key:2, d:"M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"})
  ]}),

  Save: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"}),
    h('polyline', {key:2, points:"17 21 17 13 7 13 7 21"}),
    h('polyline', {key:3, points:"7 3 7 8 15 8"})
  ]}),

  Play: (p) => Icon({...p, path: h('polygon', {points:"5 3 19 12 5 21 5 3"})}),

  Pause: (p) => Icon({...p, path: [
    h('rect', {key:1, width:"4", height:"16", x:"6", y:"4"}),
    h('rect', {key:2, width:"4", height:"16", x:"14", y:"4"})
  ]}),

  Split: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M16 3h5v5"}),
    h('path', {key:2, d:"M8 3H3v5"}),
    h('path', {key:3, d:"M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"}),
    h('path', {key:4, d:"m15 9 6-6"})
  ]}),

  ArrowRight: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M5 12h14"}),
    h('path', {key:2, d:"m12 5 7 7-7 7"})
  ]}),

  Check: (p) => Icon({...p, path: h('polyline', {points:"20 6 9 17 4 12"})}),

  ChevronRight: (p) => Icon({...p, path: h('path', {d:"m9 18 6-6-6-6"})}),

  Shield: (p) => Icon({...p, path: h('path', {d:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"})}),

  Zap: (p) => Icon({...p, path: h('polygon', {points:"13 2 3 14 12 14 11 22 21 10 12 10 13 2"})}),

  BarChart: (p) => Icon({...p, path: [
    h('line', {key:1, x1:"12", x2:"12", y1:"20", y2:"10"}),
    h('line', {key:2, x1:"18", x2:"18", y1:"20", y2:"4"}),
    h('line', {key:3, x1:"6", x2:"6", y1:"20", y2:"16"})
  ]}),

  Loader2: (p) => Icon({...p, className: `animate-spin ${p.className || ''}`, path: h('path', {d:"M21 12a9 9 0 1 1-6.219-8.56"})}),

  ArrowLeft: (p) => Icon({...p, path: [
    h('path', {key:1, d:"m12 19-7-7 7-7"}),
    h('path', {key:2, d:"M19 12H5"})
  ]}),

  Clock: (p) => Icon({...p, path: [
    h('circle', {key:1, cx:"12", cy:"12", r:"10"}),
    h('polyline', {key:2, points:"12 6 12 12 16 14"})
  ]}),

  Upload: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}),
    h('polyline', {key:2, points:"17 8 12 3 7 8"}),
    h('line', {key:3, x1:"12", y1:"3", x2:"12", y2:"15"})
  ]}),

  Download: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}),
    h('polyline', {key:2, points:"7 10 12 15 17 10"}),
    h('line', {key:3, x1:"12", y1:"15", x2:"12", y2:"3"})
  ]}),

  X: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M18 6 6 18"}),
    h('path', {key:2, d:"m6 6 12 12"})
  ]}),

  Eye: (p) => Icon({...p, path: [
    h('path', {key:1, d:"M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"}),
    h('circle', {key:2, cx:"12", cy:"12", r:"3"})
  ]}),

  Reply: (p) => Icon({...p, path: [
    h('polyline', {key:1, points:"9 17 4 12 9 7"}),
    h('path', {key:2, d:"M20 18v-2a4 4 0 0 0-4-4H4"})
  ]}),

  ChevronUp: (p) => Icon({...p, path: h('path', {d:"m18 15-6-6-6 6"})}),

  ChevronDown: (p) => Icon({...p, path: h('path', {d:"m6 9 6 6 6-6"})})
};
