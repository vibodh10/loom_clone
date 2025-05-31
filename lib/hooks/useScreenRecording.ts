import { useState, useRef, useEffect } from "react";
import {
    getMediaStreams,
    createAudioMixer,
    setupRecording,
    cleanupRecording,
    createRecordingBlob,
    calculateRecordingDuration,
} from "@/lib/utils";

export const useScreenRecording = () => {
    const [state, setState] = useState<BunnyRecordingState>({
        isRecording: false,
        recordedBlob: null,
        recordedVideoUrl: "",
        recordingDuration: 0,
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<ExtendedMediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const startTimeRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            stopRecording();
            if (state.recordedVideoUrl) URL.revokeObjectURL(state.recordedVideoUrl);

            if(audioContextRef.current?.state !== 'closed') {
                audioContextRef.current?.close().catch(console.error);
            }
            audioContextRef.current = null;
        };
    }, [state.recordedVideoUrl]);

    const handleRecordingStop = async () => {
        const { blob, url } = createRecordingBlob(chunksRef.current);
        const duration = calculateRecordingDuration(startTimeRef.current);

        // Convert Blob to base64 Data URL
        const toBase64 = (blob: Blob): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        };

        try {
            const base64Data = await toBase64(blob);

            sessionStorage.setItem("recordedVideo", JSON.stringify({
                dataUrl: base64Data,
                name: "recording.webm",
                type: "video/webm",
                duration
            }));
        } catch (error) {
            console.error("Failed to convert blob to base64:", error);
        }

        setState((prev) => ({
            ...prev,
            recordedBlob: blob,
            recordedVideoUrl: url,
            recordingDuration: duration,
            isRecording: false,
        }));
    };

    const startRecording = async (withMic = true) => {
        try {
            if (state.isRecording) {
                stopRecording();
            }

            const { displayStream, micStream, hasDisplayAudio } =
                await getMediaStreams(withMic);
            console.log("🎥 displayStream tracks:", displayStream.getTracks());

            displayStream.getTracks().forEach((track, i) => {
                console.log(`🧪 Display track ${i}: kind=${track.kind}, state=${track.readyState}, enabled=${track.enabled}`);

                track.addEventListener("ended", () => {
                    console.warn(`⚠️ Display track ${i} ended: kind=${track.kind}`);
                });
            });

            if (displayStream.getTracks().length === 0) {
                console.error("❌ No tracks found in display stream.");
                return false;
            }

            if (micStream) {
                micStream.getTracks().forEach((track, i) => {
                    console.log(`Mic Track #${i} – kind: ${track.kind}, readyState: ${track.readyState}`);
                });
            }

            const combinedStream = new MediaStream() as ExtendedMediaStream;

            displayStream
                .getVideoTracks()
                .filter(track => track.readyState === "live")
                .forEach((track: MediaStreamTrack) => combinedStream.addTrack(track));

            audioContextRef.current = new AudioContext();
            const audioDestination = createAudioMixer(
                audioContextRef.current,
                displayStream,
                micStream,
                hasDisplayAudio
            );

            audioDestination?.stream
                .getAudioTracks()
                .filter(track => track.readyState === "live")
                .forEach((track: MediaStreamTrack) => combinedStream.addTrack(track));


            combinedStream._originalStreams = [
                displayStream,
                ...(micStream ? [micStream] : []),
            ];
            streamRef.current = combinedStream;

            console.log("Combined stream tracks:", combinedStream.getTracks());
            console.log("Video tracks:", combinedStream.getVideoTracks());
            console.log("Audio tracks:", combinedStream.getAudioTracks());

            console.log("Combined stream track info:");
            console.log("  All tracks:", combinedStream.getTracks());
            console.log("  Video tracks:", combinedStream.getVideoTracks());
            console.log("  Audio tracks:", combinedStream.getAudioTracks());

            combinedStream.getTracks().forEach((track) => {
                console.log(`Track kind: ${track.kind}, readyState: ${track.readyState}, enabled: ${track.enabled}`);
            });

            try {
                // Create a new MediaStream with only live tracks to avoid errors
                const liveTracks = combinedStream.getTracks().filter(track => track.readyState === "live");
                if (liveTracks.length === 0) {
                    console.error("❌ No live tracks available to record");
                    return false;
                }
                const liveStream = new MediaStream(liveTracks);

                // Select supported mimeType for MediaRecorder
                let mimeType = "video/webm";
                if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
                    mimeType = "video/webm;codecs=vp9,opus";
                } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
                    mimeType = "video/webm;codecs=vp8,opus";
                }

                console.log("Using mimeType for MediaRecorder:", mimeType);

                mediaRecorderRef.current = setupRecording(liveStream, {
                    onDataAvailable: (e) => e.data.size && chunksRef.current.push(e.data),
                    onStop: handleRecordingStop,
                }, mimeType);
            } catch (err) {
                console.error("MediaRecorder setup failed:", err);
                return false;
            }

            chunksRef.current = [];
            startTimeRef.current = Date.now();
            console.log("✅ About to start MediaRecorder — stream details:");
            try {
                const tracks = combinedStream.getTracks();
                console.log("Combined stream before start():");
                tracks.forEach((track, index) => {
                    console.log(
                        `Track #${index} – kind: ${track.kind}, readyState: ${track.readyState}, enabled: ${track.enabled}`
                    );
                });

                if (tracks.length === 0) {
                    console.error("❌ No tracks in combined stream");
                    return false;
                }

                const deadTracks = tracks.filter((t) => t.readyState !== "live");
                if (deadTracks.length > 0) {
                    console.error("❌ Some tracks are not live:", deadTracks);
                    return false;
                }
                await new Promise(resolve => setTimeout(resolve, 200));

                console.log("Stream constraints:", combinedStream.getVideoTracks()[0]?.getSettings());
                console.trace("Calling MediaRecorder.start() with these tracks:", combinedStream.getTracks());

                mediaRecorderRef.current.start(1000);
                console.log("MediaRecorder started successfully");
            } catch (startError) {
                console.error("MediaRecorder start() failed:", startError);
                return false;
            }
            const hasEndedTrack = combinedStream.getTracks().some(t => t.readyState === "ended");
            if (hasEndedTrack) {
                console.warn("Stream has ended tracks before starting recording!");
            }
            setState((prev) => ({ ...prev, isRecording: true }));
            return true;
        } catch (error) {
            console.error("Recording error:", error);
            return false;
        }
    };

    const stopRecording = () => {
        cleanupRecording(
            mediaRecorderRef.current,
            streamRef.current,
            streamRef.current?._originalStreams
        );
        streamRef.current = null;
        setState((prev) => ({ ...prev, isRecording: false }));
    };

    const resetRecording = () => {
        stopRecording();
        if (state.recordedVideoUrl) URL.revokeObjectURL(state.recordedVideoUrl);
        setState({
            isRecording: false,
            recordedBlob: null,
            recordedVideoUrl: "",
            recordingDuration: 0,
        });
        startTimeRef.current = null;
    };

    return {
        ...state,
        startRecording,
        stopRecording,
        resetRecording,
    };
};