'use strict'

const reusify = require('reusify')
const pathToRegexp = require('path-to-regexp')

function middie (complete) {
  var middlewares = []
  var pool = reusify(Holder)

  return {
    use,
    run
  }

  function use (url, f) {
    if (typeof url === 'function') {
      f = url
      url = null
    }

    var regexp
    if (url) {
      regexp = pathToRegexp(sanitizePrefixUrl(url), [], {
        end: false,
        strict: false
      })
    }

    middlewares.push({
      regexp,
      fn: f
    })
    return this
  }

  function run (req, res, ctx) {
    if (!middlewares.length) {
      complete(null, req, res, ctx)
      return
    }

    var holder = pool.get()
    holder.req = req
    holder.res = res
    holder.url = sanitizeUrl(req.url)
    holder.originalUrl = req.url
    holder.context = ctx
    holder.done()
  }

  function Holder () {
    this.next = null
    this.req = null
    this.res = null
    this.url = null
    this.originalUrl = null
    this.context = null
    this.i = 0

    var that = this
    this.done = function (err) {
      var req = that.req
      var res = that.res
      var url = that.url
      var context = that.context
      var i = that.i++

      req.url = that.originalUrl

      if (err || middlewares.length === i) {
        complete(err, req, res, context)
        that.req = null
        that.res = null
        that.context = null
        that.i = 0
        pool.release(that)
      } else {
        var middleware = middlewares[i]
        var fn = middleware.fn
        var regexp = middleware.regexp
        if (regexp) {
          var result = regexp.exec(url)
          if (result) {
            req.url = req.url.replace(result[0], '/')
            fn(req, res, that.done)
          } else {
            that.done()
          }
        } else {
          fn(req, res, that.done)
        }
      }
    }
  }
}

function sanitizeUrl (url) {
  for (var i = 0, len = url.length; i < len; i++) {
    var charCode = url.charCodeAt(i)
    if (charCode === 63 || charCode === 35) {
      return url.slice(0, i)
    }
  }
  return url
}

function sanitizePrefixUrl (url) {
  if (url === '') return url
  if (url === '/') return ''
  if (url[url.length - 1] === '/') return url.slice(0, -1)
  return url
}

module.exports = middie
