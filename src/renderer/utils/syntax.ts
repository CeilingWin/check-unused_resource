const TOKEN_RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(var|let|const|function|return|if|else|for|while|new|this|class|extends|import|export|from|true|false|null|undefined|typeof|instanceof)\b|\b(cc|sp|ccs)\b|\b(\d+(?:\.\d+)?)\b/gm;

export function highlightSyntax(escapedHtml: string): string {
  return escapedHtml.replace(TOKEN_RE, (match, comment, str, kw, ns, num) => {
    if (comment) return `<span class="syn-cmt">${comment}</span>`;
    if (str) return `<span class="syn-str">${str}</span>`;
    if (kw) return `<span class="syn-kw">${kw}</span>`;
    if (ns) return `<span class="syn-ns">${ns}</span>`;
    if (num) return `<span class="syn-num">${num}</span>`;
    return match;
  });
}
