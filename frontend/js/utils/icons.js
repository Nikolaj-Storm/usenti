// ============================================================================
// Icons Library - SVG Icons
// ============================================================================

const Icon = ({ path, size = 24, className = "" }) => {
  return React.createElement('svg', {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className
  }, path);
};

const Icons = {
  LayoutDashboard: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('rect', {width:"7",height:"9",x:"3",y:"3",rx:"1"}), React.createElement('rect', {width:"7",height:"5",x:"14",y:"3",rx:"1"}), React.createElement('rect', {width:"7",height:"9",x:"14",y:"12",rx:"1"}), React.createElement('rect', {width:"7",height:"5",x:"3",y:"16",rx:"1"}))}),
  Send: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"m22 2-7 20-4-9-9-4Z"}), React.createElement('path', {d:"M22 2 11 13"}))}),
  Users: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}), React.createElement('circle', {cx:"9",cy:"7",r:"4"}), React.createElement('path', {d:"M22 21v-2a4 4 0 0 0-3-3.87"}), React.createElement('path', {d:"M16 3.13a4 4 0 0 1 0 7.75"}))}),
  Plus: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M5 12h14"}), React.createElement('path', {d:"M12 5v14"}))}),
  Mail: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('rect', {width:"20",height:"16",x:"2",y:"4",rx:"2"}), React.createElement('path', {d:"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"}))}),
  Layers: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('polygon', {points:"12 2 2 7 12 12 22 7 12 2"}), React.createElement('polyline', {points:"2 17 12 22 22 17"}), React.createElement('polyline', {points:"2 12 12 17 22 12"}))}),
  Settings: (p) => Icon({...p, path: React.createElement('path', {d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"})}),
  LogOut: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}), React.createElement('polyline', {points:"16 17 21 12 16 7"}), React.createElement('line', {x1:"21",x2:"9",y1:"12",y2:"12"}))}),
  Loader2: (p) => Icon({...p, className:`animate-spin ${p.className || ''}`, path: React.createElement('path', {d:"M21 12a9 9 0 1 1-6.219-8.56"})}),
  ShieldCheck: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"}), React.createElement('path', {d:"m9 12 2 2 4-4"}))}),
  Flame: (p) => Icon({...p, path: React.createElement('path', {d:"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3a9 9 0 0 0 3 3.3z"})}),
  X: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M18 6 6 18"}), React.createElement('path', {d:"m6 6 12 12"}))}),
  Check: (p) => Icon({...p, path: React.createElement('polyline', {points:"20 6 9 17 4 12"})}),
  Upload: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}), React.createElement('polyline', {points:"17 8 12 3 7 8"}), React.createElement('line', {x1:"12",y1:"3",x2:"12",y2:"15"}))}),
  FileText: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"}), React.createElement('polyline', {points:"14 2 14 8 20 8"}), React.createElement('line', {x1:"16",y1:"13",x2:"8",y2:"13"}), React.createElement('line', {x1:"16",y1:"17",x2:"8",y2:"17"}), React.createElement('line', {x1:"10",y1:"9",x2:"8",y2:"9"}))}),
  Trash2: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M3 6h18"}), React.createElement('path', {d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"}), React.createElement('path', {d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"}), React.createElement('line', {x1:"10",x2:"10",y1:"11",y2:"17"}), React.createElement('line', {x1:"14",x2:"14",y1:"11",y2:"17"}))}),
  Play: (p) => Icon({...p, path: React.createElement('polygon', {points:"5 3 19 12 5 21 5 3"})}),
  Pause: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('rect', {width:"4",height:"16",x:"6",y:"4"}), React.createElement('rect', {width:"4",height:"16",x:"14",y:"4"}))}),
  Edit: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M12 20h9"}), React.createElement('path', {d:"M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"}))}),
  Eye: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"}), React.createElement('circle', {cx:"12",cy:"12",r:"3"}))}),
  Clock: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('circle', {cx:"12",cy:"12",r:"10"}), React.createElement('polyline', {points:"12 6 12 12 16 14"}))}),
  AlertCircle: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('circle', {cx:"12",cy:"12",r:"10"}), React.createElement('line', {x1:"12",x2:"12",y1:"8",y2:"12"}), React.createElement('line', {x1:"12",x2:"12.01",y1:"16",y2:"16"}))}),
  TrendingUp: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('polyline', {points:"22 7 13.5 15.5 8.5 10.5 2 17"}), React.createElement('polyline', {points:"16 7 22 7 22 13"}))}),
  BarChart: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('line', {x1:"12",y1:"20",x2:"12",y2:"10"}), React.createElement('line', {x1:"18",y1:"20",x2:"18",y2:"4"}), React.createElement('line', {x1:"6",y1:"20",x2:"6",y2:"16"}))}),
  Zap: (p) => Icon({...p, path: React.createElement('polygon', {points:"13 2 3 14 12 14 11 22 21 10 12 10 13 2"})}),
  CheckCircle: (p) => Icon({...p, path: React.createElement(React.Fragment, null, React.createElement('path', {d:"M22 11.08V12a10 10 0 1 1-5.93-9.14"}), React.createElement('polyline', {points:"22 4 12 14.01 9 11.01"}))})
};

// Export globally
if (typeof window !== 'undefined') {
  window.Icons = Icons;
}
