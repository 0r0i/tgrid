import { Communicator } from "../../components/Communicator";
import { Driver } from "../../components/Driver";

import { Calculator } from "../providers/Calculator";
import { ICalculator } from "../controllers/ICalculator";
import { Invoke } from "../../components/Invoke";

class PseudoCommunicator<Provider> extends Communicator<Provider>
{
    private sender_: (invoke: Invoke) => void;

    public constructor(sender: (invoke: Invoke) => void, provider: Provider)
    {
        super(provider);
        this.sender_ = sender;
    }

    protected inspectReady(): Error | null { return null; }
    protected sendData(invoke: Invoke): void { this.sender_(invoke); }
    public reply(invoke: Invoke): void { this.replyData(invoke); }
}

export async function test_pseudo(): Promise<void>
{
    //----
    // SERVER & CLIENT
    //----
    // PRE-DECLARATIONS
    let server: PseudoCommunicator<Calculator>;
    let client: PseudoCommunicator<null>;
    
    // CONSTRUCT SYSTEMS
    server = new PseudoCommunicator(ivk => client.reply(ivk), new Calculator());
    client = new PseudoCommunicator(ivk => server.reply(ivk), null);

    //----
    // INTERACTS
    //----
    // GET DRIVER
    let driver: Driver<ICalculator> = client.getDriver<ICalculator>();

    // DO TEST
    await ICalculator.main(driver);
}
