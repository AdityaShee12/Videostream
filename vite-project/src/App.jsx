import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("https://video-stream-42t6.onrender.com", { withCredentials: true });

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const VideoCall = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [roomId, setRoomId] = useState("abcd");

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        localVideoRef.current.srcObject = stream;
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };
    initializeMedia();
  }, []);

  useEffect(() => {
    const createPeerConnection = () => {
      if (!localStream) return;

      peerConnectionRef.current = new RTCPeerConnection(configuration);

      localStream.getTracks().forEach((track) => {
        peerConnectionRef.current.addTrack(track, localStream);
      });

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", event.candidate, roomId);
        }
      };

      peerConnectionRef.current.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        remoteVideoRef.current.srcObject = event.streams[0];
      };
    };

    socket.on("joined", () => {
      setIsJoined(true);
      createPeerConnection();
      // socket.emit("ready", roomId);
    });

    socket.on("offer", async (offer) => {
      if (!peerConnectionRef.current) createPeerConnection();
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socket.emit("answer", answer, roomId);
    });

    socket.on("answer", async (answer) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(answer);
      }
    });

    socket.on("ice-candidate", async (candidate) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(candidate);
      }
    });

    return () => {
      socket.off("joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [localStream]);

  const handleJoinRoom = () => {
    socket.emit("join-room", roomId);
  };

  const initiateCall = async () => {
    if (!peerConnectionRef.current) return;
    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    socket.emit("offer", offer, roomId);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-8 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Video Call</h3>
        <div className="flex gap-4 mb-4">
          <div className="w-1/2">
            <h4 className="mb-2">Your Video</h4>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full border rounded-lg"
            />
          </div>
          <div className="w-1/2">
            <h4 className="mb-2">Remote Video</h4>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full border rounded-lg"
            />
          </div>
        </div>
        <button
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          onClick={handleJoinRoom}>
          Join Call
        </button>
        <button
          className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          onClick={initiateCall}
          disabled={!isJoined}>
          Start Call
        </button>
      </div>
    </div>
  );
};

export default VideoCall;