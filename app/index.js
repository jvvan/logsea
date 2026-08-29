const express = require("express");
const path = require("path");
const Docker = require("dockerode");
const http = require("http");
const { Server } = require("socket.io");
const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const app = express();
const server = http.createServer(app);
const composeProjectLabel = "com.docker.compose.project";

const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === "development" ? "*" : false,
        methods: ["GET", "POST"],
    },
});

const port = process.env.PORT || 8000;

if (process.env.NODE_ENV === "development") {
    const cors = require("cors");
    app.use(cors({ origin: "*" }));
}

if (process.env.BASIC_AUTH_USERNAME && process.env.BASIC_AUTH_PASSWORD) {
    const basicAuth = require("express-basic-auth");
    app.use(
        basicAuth({
            users: {
                [process.env.BASIC_AUTH_USERNAME]: process.env.BASIC_AUTH_PASSWORD,
            },
            challenge: true,
        })
    );
}

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("subscribe-events", async () => {
        try {
            const stream = await docker.getEvents({
                filters: {
                    type: ["container"],
                    event: [
                        "start",
                        "die",
                        "pause",
                        "unpause",
                        "health_status",
                        "restart",
                        "destroy",
                    ],
                },
            });

            stream.on("data", async (data) => {
                try {
                    const event = JSON.parse(data.toString().trim());

                    let updatedHealth, updatedStatus;
                    let composeProject =
                        event.Actor.Attributes[composeProjectLabel] || null;

                    if (event.Action === "destroy") {
                        updatedStatus = "destroyed";
                        updatedHealth = null;
                    } else {
                        const container = docker.getContainer(event.id);
                        const info = await container.inspect();

                        updatedStatus = info.State.Status;
                        updatedHealth = info.State.Health?.Status;
                        composeProject =
                            info.Config.Labels?.[composeProjectLabel] ||
                            composeProject;
                    }

                    const output = {
                        id: event.id,
                        name: event.Actor.Attributes.name.replace(/^\//, ""),
                        image: event.Actor.Attributes.image,
                        status: updatedStatus,
                        health: updatedHealth,
                        composeProject,
                    };

                    socket.emit("container-event", output);
                } catch (err) {
                    console.error("Error processing container event:", err);
                }
            });

            stream.on("end", () => {
                socket.emit("events-ended");
            });

            socket.eventsStream = stream;
        } catch (err) {
            console.error("Error subscribing to events:", err);
            socket.emit("error", "Failed to subscribe to container events");
        }
    });

    socket.on("subscribe-logs", async (containerId) => {
        try {
            if (socket.logsStream) {
                socket.logsStream.destroy();
            }

            const container = docker.getContainer(containerId);
            const stream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                tail: 100,
            });

            const isTty = (await container.inspect()).Config.Tty;

            if (isTty) {
                stream.on("data", (data) => {
                    socket.emit("container-log", {
                        containerId,
                        data: data.toString(),
                    });
                });
            } else {
                const stdoutStream = new require("stream").PassThrough();
                const stderrStream = new require("stream").PassThrough();

                docker.modem.demuxStream(stream, stdoutStream, stderrStream);

                stdoutStream.on("data", (data) => {
                    socket.emit("container-log", {
                        containerId,
                        data: data.toString(),
                        type: "stdout",
                    });
                });

                stderrStream.on("data", (data) => {
                    socket.emit("container-log", {
                        containerId,
                        data: data.toString(),
                        type: "stderr",
                    });
                });
            }

            stream.on("end", () => {
                socket.emit("logs-ended", { containerId });
            });

            socket.logsStream = stream;
        } catch (err) {
            console.error("Error subscribing to logs:", err);
            socket.emit("error", `Container ${containerId} not found`);
        }
    });

    socket.on("unsubscribe-logs", () => {
        if (socket.logsStream) {
            socket.logsStream.destroy();
            socket.logsStream = null;
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
        if (socket.eventsStream) {
            socket.eventsStream.destroy();
        }
        if (socket.logsStream) {
            socket.logsStream.destroy();
        }
    });
});

app.get("/api/containers", async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: true });
        const containerDetails = await Promise.all(
            containers.map(async (containerInfo) => {
                const container = docker.getContainer(containerInfo.Id);
                const details = await container.inspect();
                const healthStatus = details.State.Health?.Status;

                return {
                    id: containerInfo.Id,
                    name: containerInfo.Names[0].replace(/^\//, ""),
                    status: containerInfo.State,
                    health: healthStatus,
                    image: containerInfo.Image,
                    tty: details.Config.Tty,
                    composeProject:
                        details.Config.Labels?.[composeProjectLabel] || null,
                };
            })
        );

        res.json(containerDetails);
    } catch (err) {
        res.status(500).send("Failed to list containers");
    }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

server.listen(port, () => {
    console.log(`Logsea is running on port ${port}`);
});
