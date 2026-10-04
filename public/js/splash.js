
try {
    if (sessionStorage.getItem("splashSeen")) {
        document.documentElement.classList.add("splash-seen");
    } else {
        sessionStorage.setItem("splashSeen", "1");
    }
} catch (error) {
    document.documentElement.classList.add("splash-seen");
}