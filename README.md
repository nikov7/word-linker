### Overview

This is a Google Chrome extension that scans the contents of a website and tries to partially match expressions against a predetermined list. If there is a match, the expression is turned into a link.

##### Example

The expression "iphone 15 pro max" appears in both our internal list and the site, resulting in the formation of a link:
![example](images/example.png)


### Dynamic site support:
- reddit
- youtube
- x
- tiktok
- facebook
- instagram
- pinterest


## settings.json:

url: set to url that accepts strings at the end (example: "https://www.bing.com/search?q=")

#### Options
- linksPerPage: amount of links allowed to be displayed. (example: 3)
- minNodeWordCount: minimum amount of words needed to consider a text node
- maxDistance: maximum edit distance allowed
- defaultSelector: have a default selector for sites not listed

#### Sites

- selector: selectors that define where relevant content is
- color: link color override, leave empty if no change needed

There is also a default selector that activates if enabled

#### Performance

On average 7-9ms

