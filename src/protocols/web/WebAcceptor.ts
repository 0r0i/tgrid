//================================================================ 
/** @module tgrid.protocols.web */
//================================================================
import http = require("http");
import WebSocket = require("ws");

import { Communicator } from "../../components/Communicator";
import { IWebCommunicator } from "./internal/IWebCommunicator";
import { IAcceptor, Acceptor } from "../internal/IAcceptor";

import { Invoke } from "../../components/Invoke";
import { WebError } from "./WebError";
import { DomainError } from "tstl/exception";

/**
 * Web Socket Acceptor.
 *  - available only in NodeJS.
 * 
 * The `WebAcceptor` is a communicator class interacting with the remote (web socket) client
 * using RFC (Remote Function Call). The `WebAcceptor` objects are always created by the 
 * {@link WebServer} class whenever a remote client connects to its server.
 * 
 * To accept connection and start interaction with the remote client, call the {@link accept}() 
 * method with special `Provider`. Also, don't forget to closing the connection after your 
 * busines has been completed.
 * 
 * @typeParam Provider Type of features provided for remote system.
 * @wiki https://github.com/samchon/tgrid/wiki/Web-Socket
 * @author Jeongho Nam <http://samchon.org>
 */
export class WebAcceptor<Provider extends object = {}>
    extends Communicator<Provider | null | undefined>
    implements IWebCommunicator, IAcceptor<WebAcceptor.State, Provider>
{
    /**
     * @hidden
     */
    private socket_: WebSocket;

    /**
     * @hidden
     */
    private state_: WebAcceptor.State;

    /**
     * @hidden
     */
    private request_: http.IncomingMessage;

    /* ----------------------------------------------------------------
        CONSTRUCTORS
    ---------------------------------------------------------------- */
    /**
     * @internal
     */
    public static create<Provider extends object>
        (socket: WebSocket, request: http.IncomingMessage): WebAcceptor<Provider>
    {
        return new WebAcceptor<Provider>(socket, request);
    }

    /**
     * @hidden
     */
    private constructor(socket: WebSocket, request: http.IncomingMessage)
    {
        super(undefined);
        
        this.socket_ = socket;
        this.request_ = request;
        this.state_ = WebAcceptor.State.NONE;
    }

    /**
     * @inheritDoc
     */
    public async close(code?: number, reason?: string): Promise<void>
    {
        // TEST CONDITION
        let error: Error | null = this.inspectReady();
        if (error)
            throw error;
        
        //----
        // CLOSE WITH JOIN
        //----
        // PREPARE LAZY RETURN
        let ret: Promise<void> = this.join();

        // DO CLOSE
        this.state_ = WebAcceptor.State.CLOSING;
        this.socket_.close(code, reason);
        
        // state would be closed in destructor() via _Handle_close()
        await ret;
    }

    /**
     * @hidden
     */
    protected async destructor(error?: Error): Promise<void>
    {
        await super.destructor(error);
        this.state_ = WebAcceptor.State.CLOSED;
    }

    /* ----------------------------------------------------------------
        HANDSHAKES
    ---------------------------------------------------------------- */
    public async accept(provider: Provider | null = null): Promise<void>
    {
        if (this.state_ !== WebAcceptor.State.NONE)
            throw new DomainError("You've already accepted (or rejected) the connection.");

        this.state_ = WebAcceptor.State.ACCEPTING;
        this.provider_ = provider;

        this.socket_.on("message", this._Handle_message.bind(this));
        this.socket_.on("close", this._Handle_close.bind(this));
        this.state_ = WebAcceptor.State.OPEN;
    }

    /**
     * Reject connection.
     *
     * Reject without acceptance, any interaction. The connection would be closed immediately.
     *
     * @param status Status code.
     * @param reason Detailed reason to reject.
     * @param extraHeaders Extra headers if required.
     */
    public async reject(status?: number, reason?: string): Promise<void>
    {
        if (this.state_ !== WebAcceptor.State.NONE)
            throw new DomainError("You've already accepted (or rejected) the connection.");

        this.state_ = WebAcceptor.State.REJECTING;
        this.socket_.close(status, reason);
        await this.destructor();
    }

    /* ----------------------------------------------------------------
        ACCESSORS
    ---------------------------------------------------------------- */
    public get path(): string
    {
        return (this.request_.url !== undefined)
            ? this.request_.url
            : "";
    }

    /**
     * @inheritDoc
     */
    public get state(): WebAcceptor.State
    {
        return this.state_;
    }

    /* ----------------------------------------------------------------
        COMMUNICATOR
    ---------------------------------------------------------------- */
    /**
     * @hidden
     */
    protected sendData(invoke: Invoke): void
    {
        this.socket_.send(JSON.stringify(invoke));
    }

    /**
     * @hidden
     */
    protected inspectReady(): Error | null
    {
        return Acceptor.inspect(this.state_);
    }

    /**
     * @hidden
     */
    private _Handle_message(message: WebSocket.Data): void
    {
        if (typeof message === "string")
        {
            let invoke: Invoke = JSON.parse(message);
            this.replyData(invoke);
        }
    }

    /**
     * @hidden
     */
    private async _Handle_close(code: number, reason: string): Promise<void>
    {
        let error: WebError | undefined = (code !== 100)
            ? new WebError(code, reason)
            : undefined;
        
        await this.destructor(error);
    }
}

export namespace WebAcceptor
{
    export import State = Acceptor.State;
}