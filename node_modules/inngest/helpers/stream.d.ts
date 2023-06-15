/**
 * Creates a {@link ReadableStream} that sends a `value` every `interval`
 * milliseconds as a heartbeat, intended to keep a stream open.
 *
 * Returns the `stream` itself and a `finalize` function that can be used to
 * close the stream and send a final value.
 */
export declare const createStream: (opts?: {
    /**
     * The interval in milliseconds to send a heartbeat.
     *
     * Defaults to `3000`.
     */
    interval?: number;
    /**
     * The value to send as a heartbeat.
     *
     * Defaults to `" "`.
     */
    value?: string;
}) => Promise<{
    finalize: (data: unknown) => void;
    stream: ReadableStream;
}>;
//# sourceMappingURL=stream.d.ts.map