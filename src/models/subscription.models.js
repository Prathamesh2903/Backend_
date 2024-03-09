import mongoose,{Schema,mongo} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        type:Schema.Types.ObjectId, //one who is subscribing
        ref:"User"
    } , 
    channel:{
        user:Schema.Types.ObjectId  ,   // channel subscribed
        ref:"User"
   }
},{timestamps:true})


export const Subscription = mongoose.model("Subscription" , subscriptionSchema)
