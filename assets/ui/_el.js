export default class El {
  el(tag, { text, html, children, attrs = {}, props = {}, classes = [], data = {}, on = {} } = {}) {
    const n = document.createElement(tag);
    if (text != null) n.textContent = String(text);
    if (html != null) n.innerHTML = String(html);

    const cc = classes.filter(cls => typeof cls === "string" && cls.trim().length > 0);
    n.classList.add(...cc);

    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
    for (const [k, v] of Object.entries(props)) if (v !== undefined) n[k] = v;
    for (const [k, v] of Object.entries(data))  if (v != null) n.dataset[k] = String(v);
    for (const [evt, fn] of Object.entries(on)) if (typeof fn === "function") n.addEventListener(evt, fn);

    return n;
  }
}
