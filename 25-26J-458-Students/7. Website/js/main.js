/**
 * CDAP 25-26J-458 — main.js
 * Mobile nav, header scroll, scroll-reveal, stat count-up, document filter/search,
 * FAQ accordion, contact form, milestone panel, smooth behavior
 */
(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* Mobile nav */
  var navToggle = document.getElementById("navToggle");
  var siteNav = document.getElementById("siteNav");

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    siteNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.innerWidth <= 900) {
          siteNav.classList.remove("is-open");
          navToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  /* Header scroll state */
  var siteHeader = document.getElementById("siteHeader");
  if (!siteHeader) siteHeader = document.querySelector(".site-header");
  function onScrollHeader() {
    if (!siteHeader) return;
    if (window.scrollY > 8) {
      siteHeader.classList.add("is-scrolled");
    } else {
      siteHeader.classList.remove("is-scrolled");
    }
  }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  /* Scroll reveal */
  if (!reducedMotion) {
    var revealEls = $$("[data-reveal]");
    if (revealEls.length && "IntersectionObserver" in window) {
      var revObs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              e.target.classList.add("is-visible");
              revObs.unobserve(e.target);
            }
          });
        },
        { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
      );
      revealEls.forEach(function (el) {
        revObs.observe(el);
      });
    } else {
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  } else {
    $$("[data-reveal]").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* Stat count-up for [data-count][data-target] */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-target"));
    if (isNaN(target)) return;
    var suffix = el.getAttribute("data-suffix") || "";
    var prefix = el.getAttribute("data-prefix") || "";
    var decAttr = el.getAttribute("data-decimals");
    var isInt = decAttr === "0" || (decAttr == null && target % 1 === 0);
    var duration = 900;
    var start = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 2);
      var val = target * eased;
      el.textContent = prefix + (isInt ? Math.round(val) : val.toFixed(1)) + suffix;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (!reducedMotion && "IntersectionObserver" in window) {
    var countEls = $$("[data-count][data-target]");
    var countObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            animateCount(e.target);
            countObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    countEls.forEach(function (el) {
      countObs.observe(el);
    });
  } else {
    $$("[data-count][data-target]").forEach(function (el) {
      var target = el.getAttribute("data-target");
      var suffix = el.getAttribute("data-suffix") || "";
      var prefix = el.getAttribute("data-prefix") || "";
      el.textContent = prefix + target + suffix;
    });
  }

  /* Document filter + search */
  var docSearch = document.getElementById("docSearch");
  var docGrid = document.getElementById("docGrid");
  var docEmpty = document.getElementById("docEmpty");

  function getCurrentFilter() {
    var active = document.querySelector(".filter-chips .btn--primary[data-doc-filter]");
    return active && active.getAttribute("data-doc-filter") ? active.getAttribute("data-doc-filter") : "all";
  }

  function applyDocFilter() {
    if (!docGrid) return;
    var q = docSearch ? docSearch.value.trim().toLowerCase() : "";
    var filter = getCurrentFilter();
    var cards = $$("[data-doc-card]", docGrid);
    var visible = 0;
    cards.forEach(function (card) {
      var type = (card.getAttribute("data-doc-type") || "").toLowerCase();
      var title = (card.getAttribute("data-doc-title") || "").toLowerCase();
      var desc = (card.getAttribute("data-doc-desc") || "").toLowerCase();
      var typeOk = filter === "all" || type === filter;
      var searchOk = !q || title.indexOf(q) !== -1 || desc.indexOf(q) !== -1;
      var show = typeOk && searchOk;
      card.style.display = show ? "" : "none";
      if (show) visible++;
    });
    if (docEmpty) {
      docEmpty.style.display = visible === 0 ? "" : "none";
    }
  }

  $$(".filter-chips [data-doc-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      $$(".filter-chips [data-doc-filter]").forEach(function (b) {
        b.classList.remove("btn--primary");
        b.classList.add("btn--ghost");
      });
      btn.classList.remove("btn--ghost");
      btn.classList.add("btn--primary");
      applyDocFilter();
    });
  });

  if (docSearch) {
    docSearch.addEventListener("input", applyDocFilter);
  }
  applyDocFilter();

  /* FAQ accordion */
  $$(".faq-btn").forEach(function (btn, i) {
    var id = btn.getAttribute("aria-controls");
    var panel = id ? document.getElementById(id) : null;
    var item = btn.closest(".faq-item");

    btn.addEventListener("click", function () {
      var wasOpen = item && item.classList.contains("is-open");
      $$(".faq-item").forEach(function (other) {
        other.classList.remove("is-open");
        var ob = other.querySelector(".faq-btn");
        var op = ob && ob.getAttribute("aria-controls");
        var opel = op ? document.getElementById(op) : null;
        if (ob) ob.setAttribute("aria-expanded", "false");
        if (opel) opel.hidden = true;
      });
      if (!wasOpen && panel && item) {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        panel.hidden = false;
      }
    });

    btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var list = $$(".faq-btn");
        var next = e.key === "ArrowDown" ? i + 1 : i - 1;
        if (list[next]) list[next].focus();
      }
    });
  });

  /* Contact form — demo success (no network) */
  var contactForm = document.getElementById("contactForm");
  var formSuccess = document.getElementById("formSuccess");

  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (formSuccess) {
        formSuccess.classList.add("is-visible");
        formSuccess.textContent =
          "Thank you. Your message was recorded in the browser. To email the team, use the addresses on the right or the mail composer below.";
      }
      contactForm.reset();
      if (formSuccess) {
        formSuccess.focus();
        setTimeout(function () {
          formSuccess.classList.remove("is-visible");
        }, 8000);
      }
    });
  }

  /* Mailto form (optional second form) */
  var mailForm = document.getElementById("mailForm");
  if (mailForm) {
    mailForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameEl = document.getElementById("cname");
      var fromEl = document.getElementById("cemail");
      var bodyEl = document.getElementById("cmsg");
      if (!nameEl || !fromEl || !bodyEl) return;
      var name = nameEl.value.trim();
      var from = fromEl.value.trim();
      var body = bodyEl.value.trim();
      if (!name || !from || !body) return;
      var subject = encodeURIComponent("[CDAP 25-26J-458] Inquiry: Adaptive Cognitive-Load Study Timer");
      var text = "From: " + name + " <" + from + ">\r\n\r\n" + body;
      window.location.href =
        "mailto:IT22148254@my.sliit.lk?cc=IT22054418@my.sliit.lk,IT22087874@my.sliit.lk,IT22276582@my.sliit.lk,kalpani.m@sliit.lk,eishan.w@sliit.lk&subject=" +
        subject +
        "&body=" +
        encodeURIComponent(text);
    });
  }

  /* Milestones: select + JSON panel */
  var sel = document.getElementById("milestoneSelect");
  var panel = document.getElementById("milestonePanel");

  if (sel && panel) {
    var dataEl = document.getElementById("milestoneData");
    if (dataEl) {
      try {
        var milestones = JSON.parse(dataEl.textContent);
        function escapeHtml(s) {
          if (!s) return "";
          var d = document.createElement("div");
          d.textContent = s;
          return d.innerHTML;
        }
        function escapeAttr(s) {
          if (!s) return "";
          return String(s)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        }
        function renderMilestone() {
          var id = sel.value;
          var m = milestones[id];
          if (!m) {
            panel.innerHTML = "<p>No data.</p>";
            return;
          }
          var html = "<h3>" + escapeHtml(m.title) + "</h3>";
          html += '<div class="meta-row"><span>Assessment</span><span>' + escapeHtml(m.assessment) + "</span></div>";
          html += '<div class="meta-row"><span>Date</span><span>' + escapeHtml(m.date) + "</span></div>";
          html += "<p>" + escapeHtml(m.description) + "</p>";
          if (m.link && m.linkHref) {
            html += '<p><a href="' + escapeAttr(m.linkHref) + '">' + escapeHtml(m.link) + "</a></p>";
          } else if (m.link) {
            html += "<p><em>" + escapeHtml(m.link) + "</em></p>";
          }
          panel.innerHTML = html;
        }
        sel.addEventListener("change", renderMilestone);
        renderMilestone();
      } catch (err) {
        panel.innerHTML = "<p>Could not load milestone data.</p>";
      }
    }
  }

  /* Logo marquee — duplicate children for seamless loop, pause on hover, disable under reduced motion */
  function initLogoMarquee() {
    var marquees = $$("[data-marquee]");
    if (!marquees.length) return;
    marquees.forEach(function (mq) {
      var track = mq.querySelector(".logo-marquee__track");
      if (!track || track.dataset.duplicated === "true") return;
      if (reducedMotion) {
        track.style.animation = "none";
        track.style.transform = "none";
        return;
      }
      var originals = Array.prototype.slice.call(track.children);
      originals.forEach(function (node) {
        var clone = node.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
      track.dataset.duplicated = "true";
    });
  }
  initLogoMarquee();

  /* Drop-cap initialiser — only style the first letter of paragraphs that are
     long enough to read like a true lede. Skips short blurbs to avoid awkward caps. */
  function initDropcap() {
    if (reducedMotion) return;
    var ledes = $$(".lede");
    ledes.forEach(function (el) {
      var text = (el.textContent || "").trim();
      if (text.length < 140) {
        el.classList.remove("lede--with-cap");
        return;
      }
      if (!el.classList.contains("lede--with-cap")) {
        el.classList.add("lede--with-cap");
      }
    });
  }
  initDropcap();
})();
