
// @ts-nocheck
"use client"

// import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
// import { useUser } from '@clerk/nextjs';
import { BellIcon, SearchIcon } from 'lucide-react'

export function Navbar() {
    // const { user } = useUser();
    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="flex flex-col w-full sticky top-0 z-10 bg-white border-b border-b-gray-200">
            <header className="flex items-center h-16 px-4 border-b shrink-0 md:px-6 shadow-sm">
                <div className="flex items-center gap-6 text-lg font-semibold whitespace-nowrap justify-between md:gap-5 md:text-sm lg:gap-6">
                    <p className='text-xl capitalize'>Welcome 
                        {/* {user?.fullName || 'User'} */}
                        </p>
                </div>
                <div className="flex items-center w-full gap-4 ml-auto md:gap-2 lg:gap-4">
                    <p className="flex-1 ml-auto sm:flex-initial font-semibold">{currentDate}</p>
                    <form className="flex-1 ml-auto sm:flex-initial">
                        <div className="relative">
                            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                            <Input type="search" placeholder="Search" className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]" />
                        </div>
                    </form>
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <BellIcon className="w-6 h-6 text-gray-500" />
                        <span className="sr-only">Notifications</span>
                    </Button>
                    {/* <SignedOut>
                        <Button className="bg-blue-500 text-white hover:bg-blue-600">
                            <SignInButton />
                        </Button>
                    </SignedOut>
                    <SignedIn>
                        <UserButton />
                    </SignedIn> */}
                </div>
            </header>
        </div>
    )
}