const version = '10';
const staticCacheName = `static-v${version}`;
const dynamicCacheName = `dynamic-v${version}`;

const preCache = [{
    name: staticCacheName,
    urls: [
        './',
        './index.html',
        './assets/css/bootstrap.min.css',
        './assets/css/style.css',
        './assets/img/BAM-small.svg',
        './assets/js/app.js',
        './assets/js/vendor/bootstrap.min.js',
        './assets/js/vendor/signature_pad.umd.js',
        './process/ajax.php'
    ]
},{
    name: dynamicCacheName,
    urls: [
        './data/bamrates.json',
        './sigs/pixel.png'
    ]
}];

async function addCacheHeader(res) {
    if ( !res ) {
        return;
    }

    let headers = new Headers(res.headers);
    headers.set('sw-cache', true);

    let buffer = await res.arrayBuffer();
    return new Response( buffer, {
        status: res.status,
        statusText: res.statusText,
        headers: headers
    });
}

async function clearOldCache(keysToKeep) {
    let cacheKeys = await caches.keys();

    return Promise.all(
        cacheKeys
            .filter(key => keysToKeep.indexOf(key) === -1)
            .map(key => caches.delete(key))
    );
}

async function getResponseFor(req) {
    let staticCache = await caches.open(staticCacheName);
    let cacheRes = await staticCache.match(req);

    if (cacheRes) {
        console.log('got response for static cache.')
        return cacheRes;
    }

    let dynCache = await caches.open(dynamicCacheName);

    try {
        let res = await fetch(req);
        cacheRes = await dynCache.open(req);

        if (cacheRes) {
            await dynCache.put(req.url, res.clone());
        }

        return res;
    } catch (err) {
        console.log('Got no response no response from dynamic cache.');
        return await addCacheHeader(await dynCache.match(req));
    }
}

self.addEventListener('install', e => {
    console.log('Service Worker installed.');

    e.waitUntil(Promise.all(
        preCache.map(obj =>
            caches
                .open(obj.name)
                .then(cache => cache.addAll(obj.urls))  
        ).then(() => self.skipWaiting())
    ));
});

self.addEventListener('activate', e => {
    console.log('Service Worker activated.');
    e.waitUntil(clearOldCache(preCache.map(obj => obj.name)));
});

self.addEventListener('fetch', e => {
    e.respondWith(
        getResponseFor(e.request)
    );

    // e.respondWith(
    //     caches.match(e.request)
    //     .then(res => addCacheHeader(res) || fetch(e.request))
    // );
});