
// neon-sim: Neon AVM Simulator
// NeoResearch team
// Copyleft 2018 - MIT License

//import OpCode from './opcode'
//import StackItem from './stackitem'

const OpCode = require("./opcode");
const StackItem = require("./stackitem");
const Stack = require("./stack");



// calculate invocation price
class NeonSimPrice
{
   static NextInstruction(script, instPointer) {
      return parseInt(""+script[2*instPointer] + script[2*instPointer+1], 16);
   }

   // CurrentContext.OpReader.ReadByte()
   static GetInstruction(script, index) {
      return parseInt(""+script[2*index] + script[2*index+1], 16);
   }

   static ScriptGetString(script, instPointer, length) {
      return ""; // TODO: get
      // Encoding.ASCII.GetString(CurrentContext.Script, CurrentContext.InstructionPointer + 2, length);
   }

   static MaxItemSize() {
      return 1024 * 1024;
   }

   static MaxInvocationStackSize() {
      return 1024;
   }

   static MaxSizeForBigInteger() {
      return  32;
   }

   //private bool CheckBigInteger(BigInteger value)
   static CheckBigInteger(value) { // BigInteger
      return value == null ? false : value.ToByteArray().Length <= MaxSizeForBigInteger();
   }

   static GetPriceForSysCall(instPointer, script, EvaluationStack)
   {
      if (instPointer >= script.length - 3)
          return 1;
      var length = GetInstruction(script, instPointer + 1);
      if (instPointer > script.length - length - 2)
          return 1;
      var api_name = ScriptGetString(script, instPointer, length); //Encoding.ASCII.GetString(CurrentContext.Script, CurrentContext.InstructionPointer + 2, length);
      switch (api_name)
      {
          case "System.Runtime.CheckWitness":
          case "Neo.Runtime.CheckWitness":
          case "AntShares.Runtime.CheckWitness":
              return 200;
          case "System.Blockchain.GetHeader":
          case "Neo.Blockchain.GetHeader":
          case "AntShares.Blockchain.GetHeader":
              return 100;
          case "System.Blockchain.GetBlock":
          case "Neo.Blockchain.GetBlock":
          case "AntShares.Blockchain.GetBlock":
              return 200;
          case "System.Blockchain.GetTransaction":
          case "Neo.Blockchain.GetTransaction":
          case "AntShares.Blockchain.GetTransaction":
              return 100;
          case "System.Blockchain.GetTransactionHeight":
          case "Neo.Blockchain.GetTransactionHeight":
              return 100;
          case "Neo.Blockchain.GetAccount":
          case "AntShares.Blockchain.GetAccount":
              return 100;
          case "Neo.Blockchain.GetValidators":
          case "AntShares.Blockchain.GetValidators":
              return 200;
          case "Neo.Blockchain.GetAsset":
          case "AntShares.Blockchain.GetAsset":
              return 100;
          case "System.Blockchain.GetContract":
          case "Neo.Blockchain.GetContract":
          case "AntShares.Blockchain.GetContract":
              return 100;
          case "Neo.Transaction.GetReferences":
          case "AntShares.Transaction.GetReferences":
          case "Neo.Transaction.GetUnspentCoins":
              return 200;
          case "Neo.Account.SetVotes":
          case "AntShares.Account.SetVotes":
              return 1000;
          case "Neo.Validator.Register":
          case "AntShares.Validator.Register":
              return 1000 * 100000000 / ratio;
          case "Neo.Asset.Create":
          case "AntShares.Asset.Create":
              return 5000 * 100000000 / ratio;
          case "Neo.Asset.Renew":
          case "AntShares.Asset.Renew":
              return EvaluationStack.Peek(1).GetBigInteger() * 5000 * 100000000 / ratio;
          case "Neo.Contract.Create":
          case "Neo.Contract.Migrate":
          case "AntShares.Contract.Create":
          case "AntShares.Contract.Migrate":
              var fee = 100;

              // TODO: implement similar contract_properties
              //ContractPropertyState contract_properties = (ContractPropertyState)(byte)EvaluationStack.Peek(3).GetBigInteger();
              var contract_properties = EvaluationStack.Peek(3).GetBigInteger();

              //if (contract_properties.HasFlag(ContractPropertyState.HasStorage))
              if (contract_properties % 2 == 0)
              {
                  fee += 400;
              }
              //if (contract_properties.HasFlag(ContractPropertyState.HasDynamicInvoke))
              if (contract_properties % 4 == 0)
              {
                  fee += 500;
              }
              return fee * 100000000 / ratio;
          case "System.Storage.Get":
          case "Neo.Storage.Get":
          case "AntShares.Storage.Get":
              return 100;
          case "System.Storage.Put":
          case "Neo.Storage.Put":
          case "AntShares.Storage.Put":
              return ((EvaluationStack.Peek(1).GetByteArray().Length + EvaluationStack.Peek(2).GetByteArray().Length - 1) / 1024 + 1) * 1000;
          case "System.Storage.Delete":
          case "Neo.Storage.Delete":
          case "AntShares.Storage.Delete":
              return 100;
          default:
              return 1;
      }
   }


   static GetPrice(nextInstruction, script, EvaluationStack)
   {
      if (nextInstruction <= OpCode.PUSH16)
          return 0;
      switch (nextInstruction)
      {
          case OpCode.NOP:
              return 0;
          case OpCode.APPCALL:
          case OpCode.TAILCALL:
              return 10;
          case OpCode.SYSCALL:
              return GetPriceForSysCall(nextInstruction, script, EvaluationStack);
          case OpCode.SHA1:
          case OpCode.SHA256:
              return 10;
          case OpCode.HASH160:
          case OpCode.HASH256:
              return 20;
          case OpCode.CHECKSIG:
              return 100;
          case OpCode.CHECKMULTISIG:
              {
                  if (EvaluationStack.Count == 0)
                      return 1;
                  var n = EvaluationStack.Peek().GetBigInteger();
                  if (n < 1)
                      return 1;
                  return 100 * n;
              }
          default:
              return 1;
      }
   }

   // script as hexstring
   static execute( script )
   {
       var ratio = 100000;
       var gas_free = 10 * 100000000;
       var gas_consumed = 0;
       // 0: OK    1: HALT    2: FAULT
       var state = 0; // OK
       var testMode = false;
       var gas_amount = gas_free + 0; //gas.GetData(); // TODO: receive extra gas count as parameter!
       var instPointer = 0; // instruction pointer
       var EvaluationStack = new Stack();
       var AltStack = new Stack();
       while (!(state == 1) && !(state == 2)) {
           if (instPointer < script.length) {
               var nextOpcode = NeonSimPrice.NextInstruction(script, instPointer);

               var gas_consumed = gas_consumed + NeonSimPrice.GetPrice(nextOpcode, script, EvaluationStack) * ratio;
               if (!testMode && gas_consumed > gas_amount)
               {
                   state = 2; //State |= VMState.FAULT;
                   return false;
               }

               if (!NeonSimPrice.CheckItemSize(nextOpcode, EvaluationStack, AltStack) ||
                   !NeonSimPrice.CheckStackSize(nextOpcode, EvaluationStack, AltStack) ||
                   !NeonSimPrice.CheckArraySize(nextOpcode, EvaluationStack, AltStack) ||
                   !NeonSimPrice.CheckInvocationStack(nextOpcode, EvaluationStack, AltStack) ||
                   !NeonSimPrice.CheckBigIntegers(nextOpcode, EvaluationStack, AltStack) ||
                   !NeonSimPrice.CheckDynamicInvoke(nextOpcode, EvaluationStack, AltStack))
               {
                   state = 2; //State |= VMState.FAULT;
                   return false;
               }
           }
           NeonSimPrice.StepInto();
       }

       return !(state == 2);
   }

   // ==========================================================================

   // private bool CheckItemSize(OpCode nextInstruction)
   static CheckItemSize(nextInstruction, script, instPointer)
   {
       switch (nextInstruction)
       {
           case OpCode.PUSHDATA4:
               {
                   if (instPointer + 4 >= script.length)
                       return false;
                   var length = script.ToUInt32(instPointer + 1);
                   if (length > MaxItemSize())
                       return false;
                   return true;
               }
           case OpCode.CAT:
               {
                   if (EvaluationStack.Count < 2) return false;
                   var length = EvaluationStack.Peek(0).GetByteArray().length + EvaluationStack.Peek(1).GetByteArray().length;
                   if (length > MaxItemSize())
                       return false;
                   return true;
               }
           default:
               return true;
       }
   }

   // private bool CheckStackSize(OpCode nextInstruction)
   static CheckStackSize(nextInstruction, EvaluationStack, AltStack)
   {
       var size = 0;
       if (nextInstruction <= OpCode.PUSH16)
           size = 1;
       else
           switch (nextInstruction)
           {
               case OpCode.DEPTH:
               case OpCode.DUP:
               case OpCode.OVER:
               case OpCode.TUCK:
               case OpCode.NEWMAP:
                   size = 1;
                   break;
               case OpCode.UNPACK:
                   var item = EvaluationStack.Peek();
                   if (item.constructor === Array)
                       size = array.Count;
                   else
                       return false;
                   break;
           }
       if (size == 0)
           return true;
       size += EvaluationStack.Count + AltStack.Count;
       if (size > NeonSimPrice.MaxStackSize())
           return false;
       return true;
   }

   //private const uint MaxStackSize = 2 * 1024;
   static MaxStackSize() {
      return 2 * 1024;
   }

   // https://github.com/neo-project/neo-vm/blob/e2f3b1aa42073ce27343c9a95bf076ce7d19d787/src/neo-vm/ExecutionEngine.cs#L972
   //public void StepInto()
   static StepInto(instPointer, script, InvocationStack) {
           if (InvocationStack.Count == 0) State |= VMState.HALT;
           if (State.HasFlag(VMState.HALT) || State.HasFlag(VMState.FAULT)) return;
           // GetInstruction
           pcode = instPointer >= script.length ? OpCode.RET : GetInstruction();

           console.log("TODO: must add a try/catch here!");
           //try
           //{
               ExecuteOp(opcode);
           //}
           //catch()
           //{
            //    State |= VMState.FAULT;
           //}

           return instPointer; // update instPointer!
   }

   //private bool CheckArraySize(OpCode nextInstruction)
   static CheckArraySize(nextInstruction)
   {
      var size = 0;
      switch (nextInstruction)
      {
          case OpCode.PACK:
          case OpCode.NEWARRAY:
          case OpCode.NEWSTRUCT:
              {
                  if (EvaluationStack.Count == 0) return false;
                  size = EvaluationStack.Peek().GetBigInteger();
              }
              break;
          case OpCode.SETITEM:
              {
                  if (EvaluationStack.Count < 3) return false;
                  if (!(EvaluationStack.Peek(2).constructor === Map)) return true; // TODO: Deal with this Map type
                  var key = EvaluationStack.Peek(1); // StackItem
                  //if (key is ICollection) return false; // TODO: cannot handle this ICollection
                  if (map.ContainsKey(key)) return true;
                  size = map.Count + 1;
              }
              break;
          case OpCode.APPEND:
              {
                  if (EvaluationStack.Count < 2) return false;
                  if (!(EvaluationStack.Peek(1).constructor === Array)) return false; // TODO: deal with this Array type, not BigInt
                  size = array.Count + 1;
              }
              break;
          default:
              return true;
      }
      return size <= MaxArraySize();
   }

   // private bool CheckInvocationStack(OpCode nextInstruction)
   static CheckInvocationStack(nextInstruction)
   {
       switch (nextInstruction)
       {
           case OpCode.CALL:
           case OpCode.APPCALL:
               if (InvocationStack.Count >= MaxInvocationStackSize) return false;
               return true;
           default:
               return true;
       }
   }

   // private bool CheckDynamicInvoke(OpCode nextInstruction)
   static CheckDynamicInvoke(nextInstruction, instPointer, script)
   {
       if (nextInstruction == OpCode.APPCALL || nextInstruction == OpCode.TAILCALL)
       {
           for (var i = instPointer + 1; i < instPointer + 21; i++)
           {
               if (GetInstruction(script, i) != 0)
                   return true;
           }
           // if we get this far it is a dynamic call
           // now look at the current executing script
           // to determine if it can do dynamic calls
           //ContractState contract = script_table.GetContractState(CurrentContext.ScriptHash);
           //return contract.HasDynamicInvoke;
           return false; // TODO: implement
       }
       return true;
   }

   //private bool CheckBigIntegers(OpCode nextInstruction)
   static CheckBigIntegers(nextInstruction)
   {
       switch (nextInstruction)
       {
           case OpCode.SHL:
               {
                   var ishift = EvaluationStack.Peek(0).GetBigInteger(); // BigInteger

                   if ((ishift > Max_SHL_SHR || ishift < Min_SHL_SHR))
                       return false;

                   var x = EvaluationStack.Peek(1).GetBigInteger(); // BigInteger

                   //if (!CheckBigInteger(x << (int)ishift)) // TODO: fix this shift
                   if (!CheckBigInteger(x << ishift))
                       return false;

                   break;
               }
           case OpCode.SHR:
               {
                   var ishift = EvaluationStack.Peek(0).GetBigInteger(); // BigInteger

                   if ((ishift > Max_SHL_SHR || ishift < Min_SHL_SHR))
                       return false;

                   var x = EvaluationStack.Peek(1).GetBigInteger(); // BigInteger

                   //if (!CheckBigInteger(x >> (int)ishift)) // TODO: fix shift
                   if (!CheckBigInteger(x >> ishift))
                       return false;

                   break;
               }
           case OpCode.INC:
               {
                   var x = EvaluationStack.Peek().GetBigInteger(); // BigInteger

                   if (!CheckBigInteger(x) || !CheckBigInteger(x + 1))
                       return false;

                   break;
               }
           case OpCode.DEC:
               {
                   var x = EvaluationStack.Peek().GetBigInteger(); // BigInteger

                   if (!CheckBigInteger(x) || (x.Sign <= 0 && !CheckBigInteger(x - 1)))
                       return false;

                   break;
               }
           case OpCode.ADD:
               {
                   var x2 = EvaluationStack.Peek().GetBigInteger(); // BigInteger
                   var x1 = EvaluationStack.Peek(1).GetBigInteger(); // BigInteger

                   if (!CheckBigInteger(x2) || !CheckBigInteger(x1) || !CheckBigInteger(x1 + x2))
                       return false;

                   break;
               }
           case OpCode.SUB:
               {
                   var x2 = EvaluationStack.Peek().GetBigInteger(); // BigInteger
                   var x1 = EvaluationStack.Peek(1).GetBigInteger(); // BigInteger

                   if (!CheckBigInteger(x2) || !CheckBigInteger(x1) || !CheckBigInteger(x1 - x2))
                       return false;

                   break;
               }
           case OpCode.MUL:
               {
                   var x2 = EvaluationStack.Peek().GetBigInteger(); // BigInteger
                   var x1 = EvaluationStack.Peek(1).GetBigInteger(); // BigInteger

                   var lx1 = x1 == null ? 0 : x1.ToByteArray().Length; // int

                   if (lx1 > MaxSizeForBigInteger())
                       return false;

                   var lx2 = x2 == null ? 0 : x2.ToByteArray().Length; // int

                   if ((lx1 + lx2) > MaxSizeForBigInteger())
                       return false;

                   break;
               }
           case OpCode.DIV:
               {
                   var x2 = EvaluationStack.Peek().GetBigInteger(); // BigInteger
                   var x1 = EvaluationStack.Peek(1).GetBigInteger(); // BigInteger

                   if (!CheckBigInteger(x2) || !CheckBigInteger(x1))
                       return false;

                   break;
               }
           case OpCode.MOD:
               {
                   var x2 = EvaluationStack.Peek().GetBigInteger(); // BigInteger
                   var x1 = EvaluationStack.Peek(1).GetBigInteger(); // BigInteger

                   if (!CheckBigInteger(x2) || !CheckBigInteger(x1))
                       return false;

                   break;
               }
       }

       return true;
   }

   // random example
   static example() {
      return "00c56b51c57600026f69c46168124e656f2e52756e74696d652e4e6f74696679616c7566";
   }

} // NeonSimPrice

if(typeof module !== 'undefined')
   module.exports = NeonSimPrice;
