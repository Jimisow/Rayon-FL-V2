// scanner.js - Gestion du scanner de codes-barres

let html5QrCode = null;
let isScanning = false;
let currentTorchState = false;
let currentVideoTrack = null;

export async function startScanner(elementId, onCodeDetected, onError) {
    if (isScanning) {
        await stopScanner();
    }
    
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Scanner container not found');
        return false;
    }
    
    html5QrCode = new Html5Qrcode(elementId);
    
    const config = {
        fps: 15,
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0,
        rememberLastUsedCamera: true,
        supportedScanTypes: [
            Html5QrcodeScanType.SCAN_TYPE_CAMERA,
            Html5QrcodeScanType.SCAN_TYPE_FILE
        ]
    };
    
    try {
        await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            onCodeDetected,
            onError
        );
        isScanning = true;
        
        // Récupérer la track vidéo pour la torche
        const stream = html5QrCode._mediaStream;
        if (stream) {
            const track = stream.getVideoTracks()[0];
            if (track) currentVideoTrack = track;
        }
        
        return true;
    } catch (err) {
        console.error('Scanner start error:', err);
        if (onError) onError(err);
        return false;
    }
}

export async function stopScanner() {
    if (html5QrCode && isScanning) {
        try {
            await html5QrCode.stop();
        } catch (err) {
            console.warn('Stop scanner error:', err);
        }
        isScanning = false;
        currentVideoTrack = null;
    }
}

export async function toggleTorch() {
    if (!currentVideoTrack) {
        console.warn('No video track available');
        return false;
    }
    
    currentTorchState = !currentTorchState;
    try {
        await currentVideoTrack.applyConstraints({
            advanced: [{ torch: currentTorchState }]
        });
        return currentTorchState;
    } catch (err) {
        console.warn('Torch not supported:', err);
        currentTorchState = false;
        return false;
    }
}

export async function scanFromFile(onCodeDetected) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    return new Promise((resolve, reject) => {
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) {
                resolve(null);
                return;
            }
            
            const tempScanner = new Html5Qrcode('temp-scanner');
            try {
                const result = await tempScanner.scanFile(file, false);
                if (result && onCodeDetected) {
                    onCodeDetected(result);
                }
                resolve(result);
            } catch (err) {
                reject(err);
            } finally {
                tempScanner.clear();
            }
        };
        input.click();
    });
}

export function isScannerRunning() {
    return isScanning;
}