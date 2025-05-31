import React, {ReactNode} from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
        <body>
        <main>{children}</main>
        </body>
        </html>
    );
}