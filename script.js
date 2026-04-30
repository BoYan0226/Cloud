const SUPABASE_URL = "https://bgtkjqgicpjlyjnjnbwe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WOuXwKKauu6OoxV8hKU6zw_MWLNwaEz";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const cloudImages = [
  "images/cloud1.png",
  "images/cloud2.png",
  "images/cloud3.png"
];

let currentCloud = Number(localStorage.getItem("currentCloud")) || 0;

const timeText = document.getElementById("timeText");
const temperatureText = document.getElementById("temperatureText");
const inputCloud = document.getElementById("inputCloud");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const backgroundFloatingCloud = document.querySelector(".background-floating-cloud");

const DEFAULT_LATITUDE = 40.7128;
const DEFAULT_LONGITUDE = -74.0060;

const usesZeroBasedCloudIds = document.getElementById("topCloud0") !== null;

if (inputCloud) {
  inputCloud.style.backgroundImage = `url("${cloudImages[currentCloud]}")`;
}

function getTopCloud(slot) {
  const cloudNumber = usesZeroBasedCloudIds ? slot : slot + 1;
  return document.getElementById("topCloud" + cloudNumber);
}

function updateTime() {
  const now = new Date();

  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");

  timeText.textContent = hour + ":" + minute;
}

async function getTemperature(latitude, longitude) {
  const apiUrl =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + latitude +
    "&longitude=" + longitude +
    "&current=temperature_2m" +
    "&temperature_unit=celsius" +
    "&timezone=America/New_York";

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    const temperature = Math.round(data.current.temperature_2m);
    temperatureText.textContent = temperature + "°C";
  } catch (error) {
    console.log("Weather API error:", error);
    temperatureText.textContent = "--°C";
  }
}

function loadTemperature() {
  getTemperature(DEFAULT_LATITUDE, DEFAULT_LONGITUDE);
}

function setTopCloudText(slot, message) {
  const topCloud = getTopCloud(slot);

  if (!topCloud) {
    return;
  }

  const text = topCloud.querySelector(".cloud-text");

  if (!text) {
    return;
  }

  text.textContent = message || "";
}

async function loadMessages() {
  const { data, error } = await db
    .from("cloud_messages")
    .select("*")
    .order("slot", { ascending: true });

  if (error) {
    console.log("Load error:", error);
    alert("Could not load messages.");
    return;
  }

  setTopCloudText(0, "");
  setTopCloudText(1, "");
  setTopCloudText(2, "");

  data.forEach(function(item) {
    setTopCloudText(item.slot, item.message);
  });
}

async function saveMessage(slot, message) {
  const { data, error } = await db
    .from("cloud_messages")
    .upsert(
      {
        slot: slot,
        message: message,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "slot"
      }
    )
    .select();

  if (error) {
    console.log("Supabase error:", error);

    alert(
      "Supabase error:\n\n" +
      "Code: " + error.code + "\n" +
      "Message: " + error.message + "\n" +
      "Details: " + error.details + "\n" +
      "Hint: " + error.hint
    );

    return false;
  }

  console.log("Saved:", data);
  return true;
}

function createFlyingCloud(slot) {
  const startRect = inputCloud.getBoundingClientRect();

  const flyingCloud = document.createElement("div");
  flyingCloud.className = "flying-cloud";

  flyingCloud.style.left = startRect.left + window.scrollX + "px";
  flyingCloud.style.top = startRect.top + window.scrollY + "px";
  flyingCloud.style.width = startRect.width + "px";
  flyingCloud.style.height = startRect.height + "px";
  flyingCloud.style.backgroundImage = `url("${cloudImages[slot]}")`;

  document.body.appendChild(flyingCloud);

  return flyingCloud;
}

function animateCloudToTop(slot, message) {
  return new Promise(function(resolve) {
    const targetCloud = getTopCloud(slot);

    if (!targetCloud) {
      resolve();
      return;
    }

    targetCloud.classList.add("hidden-cloud");

    const flyingCloud = createFlyingCloud(slot);

    inputCloud.style.visibility = "hidden";

    const startLeft = parseFloat(flyingCloud.style.left);
    const startTop = parseFloat(flyingCloud.style.top);
    const startWidth = parseFloat(flyingCloud.style.width);
    const startHeight = parseFloat(flyingCloud.style.height);

    const duration = 2400;
    const startTime = performance.now();

    function animateFrame(currentTime) {
      const elapsed = currentTime - startTime;

      let progress = elapsed / duration;

      if (progress > 1) {
        progress = 1;
      }

      const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2;

      if (typeof moveCloudsOnScroll === "function") {
        moveCloudsOnScroll();
      }

      const endRect = targetCloud.getBoundingClientRect();

      const endLeft = endRect.left + window.scrollX;
      const endTop = endRect.top + window.scrollY;
      const endWidth = endRect.width;
      const endHeight = endRect.height;

      const currentLeft = startLeft + (endLeft - startLeft) * easedProgress;
      const currentTop = startTop + (endTop - startTop) * easedProgress;
      const currentWidth = startWidth + (endWidth - startWidth) * easedProgress;
      const currentHeight = startHeight + (endHeight - startHeight) * easedProgress;

      const sway = Math.sin(progress * Math.PI * 4) * 45 * (1 - progress);

      flyingCloud.style.left = currentLeft + "px";
      flyingCloud.style.top = currentTop + "px";
      flyingCloud.style.width = currentWidth + "px";
      flyingCloud.style.height = currentHeight + "px";
      flyingCloud.style.transform = "translateX(" + sway + "px)";

      if (progress < 1) {
        requestAnimationFrame(animateFrame);
      } else {
        setTopCloudText(slot, message);
        targetCloud.classList.remove("hidden-cloud");
        flyingCloud.remove();
        resolve();
      }
    }

    requestAnimationFrame(animateFrame);
  });
}

async function sendMessage() {
  const message = messageInput.value.trim();

  if (message === "") {
    alert("Please write something first.");
    return;
  }

  const slot = currentCloud;

  sendBtn.disabled = true;

  const saved = await saveMessage(slot, message);

  if (!saved) {
    sendBtn.disabled = false;
    return;
  }

  messageInput.value = "";

  await animateCloudToTop(slot, message);

  currentCloud = currentCloud + 1;

  if (currentCloud > 2) {
    currentCloud = 0;
  }

  localStorage.setItem("currentCloud", currentCloud);

  inputCloud.style.backgroundImage = `url("${cloudImages[currentCloud]}")`;
  inputCloud.style.visibility = "visible";

  sendBtn.disabled = false;
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", function(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

updateTime();
setInterval(updateTime, 1000);

loadTemperature();
setInterval(loadTemperature, 10 * 60 * 1000);

loadMessages();

const cloudOne = document.querySelector(".cloud-one");
const cloudTwo = document.querySelector(".cloud-two");
const cloudThree = document.querySelector(".cloud-three");
const question = document.querySelector(".question");
const inputCloudWrapper = document.querySelector(".input-cloud-wrapper");

let mouseMoveX = 0;
let mouseMoveY = 0;

function moveCloudsOnScroll() {
  const scrollY = window.scrollY;

  const maxMove = 360;
  const moveAmount = Math.min(scrollY * 0.45, maxMove);

  if (cloudOne) {
    cloudOne.style.transform = `translate3d(${-moveAmount + mouseMoveX}px, ${mouseMoveY}px, 0)`;
  }

  if (cloudTwo) {
    cloudTwo.style.transform = `translate3d(${moveAmount + mouseMoveX}px, ${mouseMoveY}px, 0)`;
  }

  if (cloudThree) {
    cloudThree.style.transform = `translate3d(${-moveAmount * 0.45 + mouseMoveX}px, ${mouseMoveY}px, 0)`;
  }

  const fadeStart = 0;
  const fadeEnd = 500;

  let questionOpacity = 1 - (scrollY - fadeStart) / (fadeEnd - fadeStart);

  if (questionOpacity < 0) {
    questionOpacity = 0;
  }

  if (questionOpacity > 1) {
    questionOpacity = 1;
  }

  if (question) {
    question.style.opacity = questionOpacity;
    question.style.transform = `translate3d(${mouseMoveX}px, ${mouseMoveY}px, 0)`;
  }

  const inputScaleStart = 400;
  const inputScaleEnd = 1300;

  let inputProgress = (scrollY - inputScaleStart) / (inputScaleEnd - inputScaleStart);

  if (inputProgress < 0) {
    inputProgress = 0;
  }

  if (inputProgress > 1) {
    inputProgress = 1;
  }

  const startScale = 1.3;
  const endScale = 1;
  const inputScale = startScale - inputProgress * (startScale - endScale);

  if (inputCloudWrapper) {
    inputCloudWrapper.style.transform =
      `translateX(-50%) translate3d(${mouseMoveX}px, ${mouseMoveY}px, 0) scale(${inputScale})`;

    inputCloudWrapper.style.opacity = inputProgress;
  }

  const backgroundScaleStart = 0;
  const backgroundScaleEnd = 1300;

  let backgroundProgress =
    (scrollY - backgroundScaleStart) / (backgroundScaleEnd - backgroundScaleStart);

  if (backgroundProgress < 0) {
    backgroundProgress = 0;
  }

  if (backgroundProgress > 1) {
    backgroundProgress = 1;
  }

  const backgroundStartScale = 1.7;
  const backgroundEndScale = 1.4;

  const backgroundScale =
    backgroundStartScale +
    backgroundProgress * (backgroundEndScale - backgroundStartScale);

  const backgroundMoveUp = -backgroundProgress * 420;

  if (backgroundFloatingCloud) {
    backgroundFloatingCloud.style.setProperty("--bg-scale", backgroundScale);
    backgroundFloatingCloud.style.setProperty("--bg-scroll-y", backgroundMoveUp + "px");
  }
}

let scrollAnimationFrame = null;

window.addEventListener("scroll", function() {
  if (scrollAnimationFrame) {
    return;
  }

  scrollAnimationFrame = requestAnimationFrame(function() {
    moveCloudsOnScroll();
    scrollAnimationFrame = null;
  });
});

moveCloudsOnScroll();

window.addEventListener("mousemove", function(event) {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  const mouseX = event.clientX - centerX;
  const mouseY = event.clientY - centerY;

  mouseMoveX = mouseX * -0.012;
  mouseMoveY = mouseY * -0.012;

  moveCloudsOnScroll();
});