(async() => {
    "use strict";

    function getWordCountRange(array) {
        const re = /[^\s]+/g;
        let max = 0;
        let min = Infinity;

        for (const value of array) {

            const match = value.match(re);
            if (match) {
                const length = match.length;

                if (length > max) {
                    max = length;
                }
                if (length < min) {
                    min = length;
                }
            }
        }
        return {min, max};
    }

    const nodeCache = new WeakSet();
    const settings = await (await fetch(chrome.runtime.getURL('/data/settings.json'))).json();
    const {min: minWordCount, max: maxWordCount} = getWordCountRange(settings.words);
    const hostname = document.location.hostname;
    let site = settings.sites[hostname.toLowerCase()];
    let linkCount = 0;

    function isNodeInsideLink(element) {

        // Check if element itself is a link
        if (element.tagName === "A") {
            return true;
        }

        // Find parent that is a link
        let parent = element.parentElement;
        while (parent) {
            if (parent.tagName === "A") {
                return true;
            }
            parent = parent.parentElement;
        }
        return false;
    }

    function extractTextNodes(elements) {
        const textNodes = [];

        for (const element of elements) {
            let treeWalker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null
            );

            let node;
            while (node = treeWalker.nextNode()) {

                if (node.nodeValue.trim().length <= 0) {
                    continue;
                }

                if (nodeCache.has(node)) {
                    continue;
                }

                if (isNodeInsideLink(node)) {
                    continue;
                }
                textNodes.push(node);
                nodeCache.add(node);
            }
        }
        return textNodes;
    }

    function processTextNodes(nodes) {
        const wordRegex = /\b[\w'-.]+\b/g;
        const linkNodes = [];

        for (const node of nodes) {

            const nodeText = node.nodeValue;
            const matches = [...nodeText.matchAll(wordRegex)];

            // Check if word count in this node is too low
            if (matches.length < settings.options.minNodeWordCount) {
                continue;
            }

            const results = [];

            // Go from biggest to lowest word count
            for (let i = maxWordCount; i >= minWordCount; i--) {
                for (let j = 0; j <= matches.length - i; j++) {

                    // End search when link limit is reached
                    if (linkCount >= settings.options.linksPerPage) {
                        results.sort((a, b) => a.start - b.start);
                        if (results.length > 0) {
                            linkNodes.push({node: node, results: results});
                        }
                        return linkNodes;
                    }

                    const words = [];
                    for (let k = 0; k < i; k++) {
                        words.push(matches[j + k][0]);
                    }
                    const expression = words.join(" ");
                    const startIndex = matches[j].index;
                    const endIndex = startIndex + expression.length;

                    // Check for overlap with existing links
                    let exists = false;
                    for (let k = 0; k < results.length; k++) {
                        if (startIndex >= results[k].start && startIndex <= results[k].end) {
                            exists = true;
                            break;
                        }
                    }

                    if (exists) {
                        continue;
                    }

                    // Check for punctuation between words
                    if (nodeText.substring(startIndex, endIndex).match(/[^a-zA-Z0-9_'\- ]/g)) {
                        continue;
                    }

                    let dist = Infinity;
                    let item = "";
                    for (const word of settings.words) {
                        const currentDist = distance(expression.toLowerCase(), word.toLowerCase());
                        if (currentDist < dist) {
                            dist = currentDist;
                            item = word;
                        }
                    }

                    if (dist <= settings.options.maxDistance) {
                        results.push({start: startIndex, end: endIndex, item: item});
                        linkCount++;
                    }
                }
            }

            results.sort((a, b) => a.start - b.start);

            if (results.length > 0) {
                linkNodes.push({node: node, results: results});
            }
        }

        return linkNodes;
    }

    function rebuildNodes(linkNodes) {
        for (const entry of linkNodes) {

            if (!(entry.node.parentNode)) {
                continue;
            }

            const node = entry.node;
            const results = entry.results;
            const nodeText = node.nodeValue;

            // Build a fragment that replaces the text node with a mix of text nodes & links
            const fragment = new DocumentFragment();
            let index = 0;
            for (const result of results) {
                if (result.start > index) {
                    fragment.append(document.createTextNode(nodeText.substring(index, result.start)));
                }

                const link = document.createElement("a");
                link.href = settings.url + result.item;
                link.textContent = nodeText.substring(result.start, result.end);

                //Set link color
                if (site && site.color) {
                    link.style.color = site.color;
                }

                fragment.append(link);
                index = result.end;
            }

            if (index < nodeText.length) {
                fragment.append(document.createTextNode(nodeText.substring(index)));
            }

            if (node.parentNode) {
                node.parentNode.replaceChild(fragment, node);
            }
        }
    }

    function handleLinks(elements) {
        const textNodes = extractTextNodes(elements);
        const linkNodes = processTextNodes(textNodes);
        rebuildNodes(linkNodes);
    }


    if (site) {
        const selector = site.selector;
        const initialPosts = document.querySelectorAll(selector);
        if (initialPosts.length > 0) {
            handleLinks(initialPosts);
        }

        const observer = new MutationObserver((mutations, observer) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        continue;
                    }

                    const posts = node.querySelectorAll(selector);
                    if (posts.length > 0) {
                        handleLinks(posts);
                    }
                }
            }
        });
        observer.observe(document.body, {childList: true, subtree: true});

    } else if (settings.options.defaultSelector) { // Default selector exists

        site = settings.sites.default;

        const selector = site.selector;
        const initialPosts = document.querySelectorAll(selector);
        if (initialPosts.length > 0) {
            handleLinks(initialPosts);
        }
    }
})();