import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import{User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { jwt } from "jsonwebtoken"

const generateAccessAndRefreshToken = async (userId)=>{
    try {
            const user =  await User.findById(userId)
            const accessToken = user.generateAccessToken()
            const refreshToken = user.refreshAccessToken()

            user.refreshToken = refreshToken
            await user.save({validateBeforeSave: false}) 

            return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

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
     //const coverImagePath = req.files?.coverImage[0]?.path
     let coverImageLocalPath;
     if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
         coverImageLocalPath = req.files.coverImage[0].path
     }

     if(!avatarLocalPath)
     {
         throw new ApiError(400,"Avatar required")
     }

     const avatar = await uploadOnCloudinary(avatarLocalPath)
     const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    

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

const loginUser = asyncHandler(async (req,res)=> {
        // get details from user 
        // check if user exists
        // password hashing 
        // check password correct 
        // access and refresh token 
        // send cookies 

        const {email ,username, password} = req.body

        if(!(username||email))
        {
            throw new ApiError(400,"username or email required")
        }

        const user = await User.findOne({
            $or: [{email} , {username}]
        })

        if(!user)
        {
            throw new ApiError(404,"User doesnot exist")
        }

        const isPasswordValid = await user.isPasswordCorrect(password)

        if(!isPasswordValid)
        {
            throw new ApiError(401,"Invalid Password Entered")
        }

        const {refreshToken , accessToken} = await generateAccessAndRefreshToken(user._id)

        const loggedInUser = await User.findById(user._id).
        select("-password -refreshToken")

        const options = {
            httpOnly : true ,
            secure : true 
        }

        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200 , 
                {
                    user :loggedInUser , accessToken , refreshToken
                },
                "User logged in successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req,res) => {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $unset: {
                    refreshToken : 1
                }
            },
            {
                new : true 
            }
        )

        const options = {
            httpOnly : true ,
            secure : true 
        }

        return res.
        status(200).
        clearCookie("accessToken" , options).
        clearCookie("refreshToken",options).
        json(new ApiResponse(200),{},"user logged out")
})

const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized Request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"Invalid Refresh Token")
        }
        
         if(incomingRefreshToken != user?.refreshToken){
            throw new ApiError(401,"Refresh Token is expired or used")
         }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res.
        status(200).
        cookie("accessToken",accessToken,options).
        cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(200,
                {accessToken,refreshToken:newRefreshToken},
                "access token refreshed successfully")
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "invalid refresh token")
    }

})

export {registerUser,loginUser,logoutUser,refreshAccessToken}