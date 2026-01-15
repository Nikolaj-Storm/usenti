// Mr. Snowman - Dashboard Component

const Dashboard = () => {
  const { createElement: h } = React;

  return h('div', { className: "space-y-8 animate-fade-in" },
    h('div', null,
      h('h2', { className: "font-serif text-3xl text-jaguar-900" }, 'Overview'),
      h('p', { className: "text-stone-500 mt-2" }, 'Your campaign performance at a glance.')),
    h('div', { className: "grid grid-cols-1 md:grid-cols-4 gap-6" },
      ['Total Sent', 'Open Rate', 'Click Rate', 'Reply Rate'].map(label =>
        h('div', { key: label, className: "bg-white rounded-xl p-6 border border-stone-200 shadow-sm" },
          h('p', { className: "text-stone-500 text-sm" }, label),
          h('p', { className: "text-3xl font-bold text-jaguar-900 mt-2" }, '0')))));
};
