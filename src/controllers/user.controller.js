import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import{User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = asyncHandler(async (req,res) =>{
    
     // get user details from frontend 
     // validation - not empty 
     // check if user already exists : username or email 
     // check for images , avatar 
     // upload them to cloudinary , avatar 
     // create user object - create entry in db 
     // remove password and refresh token field from response 
     // check for userCreation 
     // return response 


     const {fullName  , email , username , password}  = req.body
     console.log("EMAIL: ",email);

     if(
      [fullName,email,username,password].some((field)=>{
         field?.trim()===""
      })
     )
     {
         throw new ApiError(400,"Full Name is required")
     }

     const existedUser = await User.findOne({
         $or: [{username} , {email}]
     })

     if(existedUser)
     {
         throw new ApiError(409,"User Already Exists")
     }

     const avatarLocalPath = req.files?.avatar[0]?.path
     const coverImagePath = req.files?.coverImage[0]?.path

     if(!avatarLocalPath)
     {
         throw new ApiError(400,"Avatar required")
     }

     const avatar = await uploadOnCloudinary(avatarLocalPath)
     const coverImage = await uploadOnCloudinary(coverImagePath) ;

     if(!avatar){
         throw new ApiError(400,"Avatar required")
     }

     const user = await User.create({
      fullName,
      avatar: avatar.url ,
      coverImage:coverImage?.url || "" ,
      email,
      password,
      username: username.toLowerCase() 
     })

     const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
     )

     if(!createdUser)
     {
         throw new ApiError(500,"something went wrong while registering user")
     }

     return res.status(201).json(
      new ApiResponse(200,createdUser,"User Registered Successfully")
     )

})

export {registerUser}