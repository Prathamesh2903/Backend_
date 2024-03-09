import mongoose , {Schema, mongo} from "mongoose";

const playlistSchema = new Schema({
        videos:[
            {
                type:Schema.Types.ObjectId,
                ref:"Video"
            }
        ],
        createdBy:{
            type:Schema.Types.ObjectId,
            ref:"User"
        },
        name:{
            type:"String",
            required:true
        }
},{timestamps:true})


export const Playlist = mongoose.model("Playlist" , playlistSchema)